'use server'

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { products, cards, reviews, reviewReplies, categories } from "@/lib/db/schema"
import { eq, sql, inArray, and, or, isNull, lte } from "drizzle-orm"
import { sendBarkMessage, sendTelegramMessage } from "@/lib/notifications"
import { revalidatePath, updateTag } from "next/cache"
import { setSetting, getSetting, recalcProductAggregates, recalcProductAggregatesForMany, getProductForAdmin } from "@/lib/db/queries"
import { isAdminUsername } from "@/lib/admin-auth"
import { getProductCardApiConfig, pullOneCardFromApi, saveProductCardApiConfig } from "@/lib/card-api"
import { unstable_noStore } from "next/cache"
import { isThemeFont } from "@/lib/theme-fonts"
import { normalizeCurrencyUnit } from "@/lib/currency-unit"
import {
    PRODUCT_GALLERY_MAX_ITEMS,
    PRODUCT_GALLERY_MAX_JSON_LENGTH,
    normalizeProductImageRefs,
    parseStoredProductImages,
    splitProductImageGallery,
    validateProductImageRef,
} from "@/lib/product-images"

export async function checkAdmin() {
    const session = await auth()
    const user = session?.user
    if (!user || !isAdminUsername(user.username)) {
        throw new Error("Unauthorized")
    }
}

export async function saveProduct(formData: FormData) {
    await checkAdmin()

    const existingId = formData.get('id') as string
    const customSlug = (formData.get('slug') as string)?.trim()

    // Determine product ID
    let id: string
    if (existingId) {
        // Editing existing product - ALWAYS keep the original id (slug is read-only for existing products)
        id = existingId
    } else {
        // New product - use custom slug or generate
        id = customSlug || `prod_${Date.now()}`

        // Validate slug format for new products
        if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
            throw new Error("Slug can only contain letters, numbers, underscores and hyphens")
        }
    }

    const name = formData.get('name') as string
    const description = formData.get('description') as string
    const price = formData.get('price') as string
    const compareAtPrice = (formData.get('compareAtPrice') as string | null) || null
    const maxPointsDiscountRaw = String(formData.get('maxPointsDiscount') || '').trim()
    const maxPointsDiscount = maxPointsDiscountRaw === ''
        ? null
        : (() => {
            const value = Number(maxPointsDiscountRaw)
            if (!Number.isFinite(value) || value < 0) {
                throw new Error("Invalid max points discount")
            }
            return Math.floor(value).toFixed(2)
        })()
    const category = formData.get('category') as string
    const image = (formData.get('image') as string || '').trim()
    const productImagesRaw = (formData.get('productImages') as string | null)?.trim() || null
    const purchaseLimit = formData.get('purchaseLimit') ? parseInt(formData.get('purchaseLimit') as string) : null
    const isHot = formData.get('isHot') === 'on'
    const isShared = formData.get('isShared') === 'on'
    const purchaseWarning = (formData.get('purchaseWarning') as string | null)?.trim() || null
    const visibilityLevelRaw = (formData.get('visibilityLevel') as string | null)?.trim() ?? ''
    const variantGroupId = (formData.get('variantGroupId') as string | null)?.trim() || null
    const variantLabel = (formData.get('variantLabel') as string | null)?.trim() || null
    const purchaseQuestionsRaw = (formData.get('purchaseQuestions') as string | null)?.trim() || null
    let purchaseQuestions: string | null = null
    if (purchaseQuestionsRaw) {
        try {
            const parsed = JSON.parse(purchaseQuestionsRaw)
            if (Array.isArray(parsed)) {
                const valid = parsed.filter((item: any) => item && typeof item.q === 'string' && item.q.trim() && typeof item.a === 'string' && item.a.trim())
                purchaseQuestions = valid.length > 0 ? JSON.stringify(valid.map((item: any) => ({ q: item.q.trim(), a: item.a.trim() }))) : null
            }
        } catch {
            // ignore invalid JSON
        }
    }
    const parsedVisibility = Number.parseInt(visibilityLevelRaw, 10)
    const visibilityLevel = Number.isFinite(parsedVisibility) ? parsedVisibility : -1
    if (![ -1, 0, 1, 2, 3 ].includes(visibilityLevel)) {
        throw new Error("Invalid visibility level")
    }
    const submittedGallery = normalizeProductImageRefs([image, ...parseStoredProductImages(productImagesRaw)])
    if (submittedGallery.length > PRODUCT_GALLERY_MAX_ITEMS) {
        throw new Error(`Product gallery supports up to ${PRODUCT_GALLERY_MAX_ITEMS} images`)
    }
    for (const [index, galleryImage] of submittedGallery.entries()) {
        validateProductImageRef(galleryImage, index === 0 ? "Product image" : `Product gallery image ${index}`)
    }

    const {
        primaryImage,
        additionalImagesJson,
    } = splitProductImageGallery(image, productImagesRaw)

    if (additionalImagesJson && additionalImagesJson.length > PRODUCT_GALLERY_MAX_JSON_LENGTH) {
        throw new Error("Additional product images are too large")
    }

    const doSave = async () => {
        // Auto-create category if it doesn't exist
        if (category) {
            await ensureCategoriesTable()
            await db.run(sql`
                INSERT INTO categories (name, updated_at) 
                VALUES (${category}, (unixepoch() * 1000)) 
                ON CONFLICT (name) DO NOTHING
            `)
        }

        await db.insert(products).values({
            id,
            name,
            description,
            price,
            compareAtPrice: compareAtPrice && compareAtPrice !== '0' ? compareAtPrice : null,
            maxPointsDiscount,
            category,
            image: primaryImage,
            productImages: additionalImagesJson,
            purchaseLimit,
            purchaseWarning,
            isHot,
            isShared,
            visibilityLevel,
            variantGroupId,
            variantLabel,
            purchaseQuestions
        }).onConflictDoUpdate({
            target: products.id,
            set: {
                name,
                description,
                price,
                compareAtPrice: compareAtPrice && compareAtPrice !== '0' ? compareAtPrice : null,
                maxPointsDiscount,
                category,
                image: primaryImage,
                productImages: additionalImagesJson,
                purchaseLimit,
                purchaseWarning,
                isHot,
                isShared,
                visibilityLevel,
                variantGroupId,
                variantLabel,
                purchaseQuestions
            }
        })
    }

    // Ensure all product columns exist before saving
    const ensureColumns = async () => {
        try {
            await db.run(sql.raw(`ALTER TABLE products ADD COLUMN compare_at_price TEXT`));
        } catch { /* column exists */ }
        try {
            await db.run(sql.raw(`ALTER TABLE products ADD COLUMN max_points_discount TEXT`));
        } catch { /* column exists */ }
        try {
            await db.run(sql.raw(`ALTER TABLE products ADD COLUMN is_hot INTEGER DEFAULT 0`));
        } catch { /* column exists */ }
        try {
            await db.run(sql.raw(`ALTER TABLE products ADD COLUMN purchase_warning TEXT`));
        } catch { /* column exists */ }
        try {
            await db.run(sql.raw(`ALTER TABLE products ADD COLUMN is_shared INTEGER DEFAULT 0`));
        } catch { /* column exists */ }
        try {
            await db.run(sql.raw(`ALTER TABLE products ADD COLUMN visibility_level INTEGER DEFAULT -1`));
        } catch { /* column exists */ }
        try {
            await db.run(sql.raw(`ALTER TABLE products ADD COLUMN product_images TEXT`));
        } catch { /* column exists */ }
    }

    try {
        await doSave()
    } catch (error: any) {
        const errorString = JSON.stringify(error) + (error?.message || '')
        if (errorString.includes('42703') || errorString.includes('no such column') || errorString.includes('SQLITE_ERROR')) {
            await ensureColumns()
            await doSave()
        } else {
            throw error
        }
    }

    try {
        await recalcProductAggregates(id)
    } catch {
        // best effort
    }

    revalidatePath('/admin/products')
    revalidatePath(`/admin/product/edit/${id}`)
    revalidatePath('/admin/settings')
    revalidatePath('/')
    updateTag('home:products')
    updateTag('home:ratings')
    updateTag('home:categories')
    updateTag('home:product-categories')
}

export async function getProductForAdminAction(id: string) {
    await checkAdmin()
    unstable_noStore()
    return getProductForAdmin(id)
}

export async function deleteProduct(id: string) {
    await checkAdmin()
    await db.delete(products).where(eq(products.id, id))
    revalidatePath('/admin/products')
    revalidatePath('/admin/settings')
    revalidatePath('/')
    updateTag('home:products')
    updateTag('home:ratings')
    updateTag('home:categories')
    updateTag('home:product-categories')
}

export async function toggleProductStatus(id: string, isActive: boolean) {
    await checkAdmin()
    await db.update(products).set({ isActive }).where(eq(products.id, id))
    revalidatePath('/admin/products')
    revalidatePath('/admin/settings')
    revalidatePath('/')
    updateTag('home:products')
    updateTag('home:product-categories')
}

export async function reorderProduct(id: string, newOrder: number) {
    await checkAdmin()
    await db.update(products).set({ sortOrder: newOrder }).where(eq(products.id, id))
    revalidatePath('/admin/products')
    revalidatePath('/admin/settings')
    revalidatePath('/')
    updateTag('home:products')
    updateTag('home:product-categories')
}

export async function addCards(formData: FormData) {
    await checkAdmin()

    const productId = formData.get('product_id') as string
    const rawCards = formData.get('cards') as string
    const hoursRaw = String(formData.get('expires_hours') || '').trim()
    const minutesRaw = String(formData.get('expires_minutes') || '').trim()
    const hasStructured = hoursRaw !== '' || minutesRaw !== ''

    let expiresInMs: number | null = null

    if (hasStructured) {
        const hours = hoursRaw === '' ? 0 : Number(hoursRaw)
        const minutes = minutesRaw === '' ? 0 : Number(minutesRaw)
        const validInts = Number.isInteger(hours) && Number.isInteger(minutes)
        if (!validInts || hours < 0 || minutes < 0 || minutes > 59) {
            return { success: false, error: "admin.cards.expiryInvalid" }
        }
        const totalMinutes = hours * 60 + minutes
        if (totalMinutes <= 0) {
            return { success: false, error: "admin.cards.expiryInvalid" }
        }
        expiresInMs = totalMinutes * 60 * 1000
    }

    const expiresAt = expiresInMs ? new Date(Date.now() + expiresInMs) : null

    const cardList = rawCards
        .split(/[\n,]+/)
        .map(c => c.trim())
        .filter(c => c)

    if (cardList.length === 0) return { success: true }

    // D1 has a limit on SQL variables (around 100 bindings per query)
    // Drizzle generates bindings for all columns (~8), so 100/8 ≈ 12 max
    const BATCH_SIZE = 10
    for (let i = 0; i < cardList.length; i += BATCH_SIZE) {
        const batch = cardList.slice(i, i + BATCH_SIZE)
        await db.insert(cards).values(
            batch.map(key => ({
                productId,
                cardKey: key,
                expiresAt
            }))
        )
    }
    try {
        await recalcProductAggregates(productId)
    } catch {
        // best effort
    }

    revalidatePath('/admin/products')
    revalidatePath('/admin/settings')
    revalidatePath(`/admin/cards/${productId}`)
    revalidatePath('/')
    updateTag('home:products')
    updateTag('home:product-categories')

    return { success: true }
}

export async function deleteCard(cardId: number) {
    await checkAdmin()

    // Only delete unused cards
    const card = await db.query.cards.findFirst({
        where: eq(cards.id, cardId)
    })

    if (!card) {
        throw new Error("Card not found")
    }

    if (card.isUsed) {
        throw new Error("Cannot delete used card")
    }
    if (card.reservedAt && card.reservedAt > new Date(Date.now() - 60 * 1000)) {
        throw new Error("Cannot delete reserved card")
    }

    await db.delete(cards).where(eq(cards.id, cardId))
    try {
        await recalcProductAggregates(card.productId)
    } catch {
        // best effort
    }

    revalidatePath('/admin/products')
    revalidatePath('/admin/settings')
    revalidatePath('/admin/cards')
    revalidatePath('/')
    updateTag('home:products')
    updateTag('home:product-categories')
}

export async function deleteCards(cardIds: number[]) {
    await checkAdmin()

    if (!cardIds.length) return

    const BATCH_SIZE = 100
    const productIds: string[] = []
    for (let i = 0; i < cardIds.length; i += BATCH_SIZE) {
        const batch = cardIds.slice(i, i + BATCH_SIZE)

        try {
            const rows = await db.select({ productId: cards.productId })
                .from(cards)
                .where(inArray(cards.id, batch))
            productIds.push(...rows.map(r => r.productId))
        } catch {
            // best effort
        }

        await db.delete(cards)
            .where(
                and(
                    inArray(cards.id, batch),
                    or(isNull(cards.isUsed), eq(cards.isUsed, false)),
                    or(isNull(cards.reservedAt), lte(cards.reservedAt, new Date(Date.now() - 60 * 1000)))
                )
            )
    }
    try {
        await recalcProductAggregatesForMany(productIds)
    } catch {
        // best effort
    }

    revalidatePath('/admin/products')
    revalidatePath('/admin/settings')
    revalidatePath('/admin/cards')
    revalidatePath('/')
    updateTag('home:products')
    updateTag('home:product-categories')
}

export async function saveCardsApiConfig(productId: string, apiUrl: string, apiToken: string, enabled: boolean) {
    await checkAdmin()

    const id = String(productId || "").trim()
    if (!id) throw new Error("Invalid product id")

    const url = String(apiUrl || "").trim()
    const token = String(apiToken || "").trim()
    const safeEnabled = !!enabled

    if (safeEnabled && !url) {
        throw new Error("API URL is required")
    }

    if (url.length > 1000) {
        throw new Error("API URL is too long")
    }
    if (token.length > 1000) {
        throw new Error("API token is too long")
    }

    if (url) {
        try {
            // Validate URL format early to avoid runtime fetch failures.
            void new URL(url)
        } catch {
            throw new Error("Invalid API URL")
        }
    }

    await saveProductCardApiConfig(id, {
        enabled: safeEnabled,
        url,
        token,
    })

    let autoPulled = false
    let autoPullError: string | null = null
    if (safeEnabled && url) {
        const pullResult = await pullOneCardFromApi(id)
        if (pullResult.ok) {
            autoPulled = true
            try {
                await recalcProductAggregates(id)
            } catch {
                // best effort
            }
        } else if (!pullResult.skipped) {
            autoPullError = pullResult.error || "api_pull_failed"
        }
    }

    revalidatePath(`/admin/cards/${id}`)
    revalidatePath('/admin/products')
    revalidatePath('/admin/settings')
    revalidatePath('/')
    updateTag('home:products')
    updateTag('home:product-categories')

    return {
        success: true,
        autoPulled,
        autoPullError,
    }
}

export async function setCardsApiEnabled(
    productId: string,
    enabled: boolean,
    apiUrl?: string,
    apiToken?: string
) {
    await checkAdmin()

    const id = String(productId || "").trim()
    if (!id) throw new Error("Invalid product id")

    const current = await getProductCardApiConfig(id)
    const nextUrl = typeof apiUrl === "string" ? apiUrl.trim() : current.url
    const nextToken = typeof apiToken === "string" ? apiToken.trim() : current.token

    if (nextUrl.length > 1000) {
        throw new Error("API URL is too long")
    }
    if (nextToken.length > 1000) {
        throw new Error("API token is too long")
    }
    if (nextUrl) {
        try {
            void new URL(nextUrl)
        } catch {
            throw new Error("Invalid API URL")
        }
    }

    if (enabled && !nextUrl) {
        throw new Error("API URL is required")
    }

    await saveProductCardApiConfig(id, {
        enabled,
        url: nextUrl,
        token: nextToken,
    })

    let autoPulled = false
    let autoPullError: string | null = null
    if (enabled && nextUrl) {
        const pullResult = await pullOneCardFromApi(id)
        if (pullResult.ok) {
            autoPulled = true
            try {
                await recalcProductAggregates(id)
            } catch {
                // best effort
            }
        } else if (!pullResult.skipped) {
            autoPullError = pullResult.error || "api_pull_failed"
        }
    }

    revalidatePath(`/admin/cards/${id}`)
    revalidatePath('/admin/products')
    revalidatePath('/admin/settings')
    revalidatePath('/')
    updateTag('home:products')
    updateTag('home:product-categories')

    return { success: true, autoPulled, autoPullError }
}

export async function pullCardFromApi(productId: string) {
    await checkAdmin()
    const id = String(productId || "").trim()
    if (!id) throw new Error("Invalid product id")

    const result = await pullOneCardFromApi(id)
    if (!result.ok) {
        throw new Error(result.error || "api_pull_failed")
    }

    try {
        await recalcProductAggregates(id)
    } catch {
        // best effort
    }

    revalidatePath(`/admin/cards/${id}`)
    revalidatePath('/admin/products')
    revalidatePath('/admin/settings')
    revalidatePath('/')
    updateTag('home:products')
    updateTag('home:product-categories')

    return { success: true, cardKey: result.cardKey || null }
}

export async function saveShopName(rawName: string) {
    await checkAdmin()

    const name = rawName.trim()
    if (!name) {
        throw new Error("Shop name cannot be empty")
    }
    if (name.length > 64) {
        throw new Error("Shop name is too long")
    }

    try {
        await setSetting('shop_name', name)
    } catch (error: any) {
        // If settings table doesn't exist, create it and retry
        if (error.message?.includes('does not exist') ||
            error.code === '42P01' ||
            JSON.stringify(error).includes('42P01')) {
            await db.run(sql`
                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT,
                    updated_at INTEGER DEFAULT (unixepoch() * 1000)
                )
            `)
            await setSetting('shop_name', name)
        } else {
            throw error
        }
    }

    revalidatePath('/')
    revalidatePath('/admin/products')
    revalidatePath('/admin/settings')
    updateTag('home:products')
    updateTag('home:product-categories')
}

export async function saveShopDescription(rawDesc: string) {
    await checkAdmin()

    const desc = rawDesc.trim()
    if (desc.length > 200) {
        throw new Error("Description is too long")
    }

    await setSetting('shop_description', desc)
    revalidatePath('/')
    revalidatePath('/admin/products')
    revalidatePath('/admin/settings')
    updateTag('home:products')
    updateTag('home:product-categories')
}

export async function saveShopLogo(logoUrl: string) {
    await checkAdmin()

    const url = logoUrl.trim()
    if (url.startsWith('data:')) {
        if (!url.startsWith('data:image/')) {
            throw new Error("Only image data URLs are allowed")
        }
        if (url.length > 1_000_000) {
            throw new Error("Logo image is too large")
        }
    } else if (url && url.length > 500) {
        throw new Error("Logo URL is too long")
    }

    await setSetting('shop_logo', url)
    await setSetting('shop_logo_source', url ? 'custom' : 'generated')
    await setSetting('shop_logo_updated_at', String(Date.now()))
    revalidatePath('/')
    revalidatePath('/admin/products')
    revalidatePath('/admin/settings')
    revalidatePath('/admin/settings')
    updateTag('home:products')
    updateTag('home:product-categories')
}

export async function saveRefundReclaimCards(enabled: boolean) {
    await checkAdmin()
    await setSetting('refund_reclaim_cards', enabled ? 'true' : 'false')
    revalidatePath('/admin/settings')
}

export async function deleteReview(reviewId: number) {
    await checkAdmin()
    const existing = await db.select({
        productId: reviews.productId,
    }).from(reviews).where(eq(reviews.id, reviewId)).limit(1)

    await db.delete(reviews).where(eq(reviews.id, reviewId))

    const productId = existing[0]?.productId
    if (productId) {
        await recalcProductAggregates(productId)
        revalidatePath(`/buy/${productId}`)
    }

    revalidatePath('/admin/reviews')
    updateTag('home:ratings')
    updateTag('home:products')
    revalidatePath('/')
}

export async function deleteReviewReply(replyId: number) {
    await checkAdmin()
    const existing = await db.select({
        productId: reviews.productId,
    })
        .from(reviewReplies)
        .leftJoin(reviews, eq(reviewReplies.reviewId, reviews.id))
        .where(eq(reviewReplies.id, replyId))
        .limit(1)

    await db.delete(reviewReplies).where(eq(reviewReplies.id, replyId))

    const productId = existing[0]?.productId
    if (productId) {
        revalidatePath(`/buy/${productId}`)
    }

    revalidatePath('/admin/reviews')
    revalidatePath('/')
}

export async function saveLowStockThreshold(raw: string) {
    await checkAdmin()
    const n = Number.parseInt(String(raw || '').trim(), 10)
    const value = Number.isFinite(n) && n > 0 ? String(n) : '5'
    await setSetting('low_stock_threshold', value)
    revalidatePath('/admin/products')
    revalidatePath('/admin/settings')
    updateTag('home:products')
    updateTag('home:product-categories')
}

export async function saveCheckinReward(raw: string) {
    await checkAdmin()
    const n = Number.parseInt(String(raw || '').trim(), 10)
    const value = Number.isFinite(n) && n > 0 ? String(n) : '10'
    await setSetting('checkin_reward', value)
    revalidatePath('/admin/products')
    revalidatePath('/admin/settings')
    updateTag('home:products')
    updateTag('home:product-categories')
}

export async function saveCheckinEnabled(enabled: boolean) {
    await checkAdmin()
    await setSetting('checkin_enabled', enabled ? 'true' : 'false')
    revalidatePath('/admin/products')
    revalidatePath('/admin/settings')
    revalidatePath('/')
    updateTag('home:products')
    updateTag('home:product-categories')
}

export async function saveNoIndex(enabled: boolean) {
    await checkAdmin()
    await setSetting('noindex_enabled', enabled ? 'true' : 'false')
    revalidatePath('/admin/products')
    revalidatePath('/admin/settings')
    revalidatePath('/')
    updateTag('home:products')
    updateTag('home:product-categories')
}

export async function saveWishlistEnabled(enabled: boolean) {
    await checkAdmin()
    await setSetting('wishlist_enabled', enabled ? 'true' : 'false')
    revalidatePath('/admin/settings')
    revalidatePath('/')
    revalidatePath('/wishlist')
}

export async function saveRegistryHideNav(enabled: boolean) {
    await checkAdmin()
    const optIn = await getSetting('registry_opt_in')
    const shouldHide = enabled && optIn !== 'true'
    await setSetting('registry_hide_nav', shouldHide ? 'true' : 'false')
    revalidatePath('/admin/settings')
    revalidatePath('/')
}

export async function saveShopFooter(footer: string) {
    await checkAdmin()

    const text = footer.trim()
    if (text.length > 500) {
        throw new Error("Footer text is too long")
    }

    await setSetting('shop_footer', text)
    revalidatePath('/admin/settings')
    revalidatePath('/')
    updateTag('home:products')
    updateTag('home:product-categories')
}

export async function saveCurrencyUnit(rawCurrencyUnit: string) {
    await checkAdmin()

    const currencyUnit = normalizeCurrencyUnit(rawCurrencyUnit) || ''
    if (currencyUnit.length > 20) {
        throw new Error("Currency unit is too long")
    }

    await setSetting('currency_unit', currencyUnit)
    revalidatePath('/admin/settings')
    revalidatePath('/')
    updateTag('home:products')
    updateTag('home:product-categories')
}

const VALID_THEME_COLORS = ['purple', 'indigo', 'blue', 'cyan', 'teal', 'green', 'lime', 'amber', 'orange', 'red', 'rose', 'pink', 'black']

export async function saveThemeColor(color: string) {
    await checkAdmin()

    if (!VALID_THEME_COLORS.includes(color)) {
        throw new Error("Invalid theme color")
    }

    await setSetting('theme_color', color)
    revalidatePath('/admin/settings')
    revalidatePath('/')
    updateTag('home:products')
    updateTag('home:product-categories')
}

export async function saveThemeFont(font: string) {
    await checkAdmin()

    if (!isThemeFont(font)) {
        throw new Error("Invalid theme font")
    }

    await setSetting('theme_font', font)
    revalidatePath('/admin/settings')
    revalidatePath('/')
    updateTag('home:products')
    updateTag('home:product-categories')
}

export async function saveNotificationSettings(formData: FormData) {
    await checkAdmin()

    const parseBooleanField = (key: string) => {
        const values = formData.getAll(key).map(v => String(v).toLowerCase())
        if (values.some(v => v === 'true' || v === 'on' || v === '1')) {
            return true
        }
        if (values.some(v => v === 'false' || v === 'off' || v === '0')) {
            return false
        }
        return false
    }

    const token = (formData.get('telegramBotToken') as string || '').trim()
    const chatId = (formData.get('telegramChatId') as string || '').trim()
    const language = (formData.get('telegramLanguage') as string || 'zh').trim()
    const telegramEnabled = parseBooleanField('telegramEnabled')

    await setSetting('telegram_bot_token', token)
    await setSetting('telegram_chat_id', chatId)
    await setSetting('telegram_language', language)
    await setSetting('telegram_enabled', telegramEnabled ? 'true' : 'false')

    // Bark settings
    const barkEnabled = parseBooleanField('barkEnabled')
    const barkServerUrl = (formData.get('barkServerUrl') as string || '').trim()
    const barkDeviceKey = (formData.get('barkDeviceKey') as string || '').trim()

    await setSetting('bark_enabled', barkEnabled ? 'true' : 'false')
    await setSetting('bark_server_url', barkServerUrl || 'https://api.day.app')
    await setSetting('bark_device_key', barkDeviceKey)

    // Email settings
    const resendApiKey = (formData.get('resendApiKey') as string || '').trim()
    const resendFromEmail = (formData.get('resendFromEmail') as string || '').trim()
    const resendFromName = (formData.get('resendFromName') as string || '').trim()
    const resendEnabled = parseBooleanField('resendEnabled')
    const emailLanguageRaw = (formData.get('emailLanguage') as string || '').trim()
    const emailLanguage = emailLanguageRaw === 'en' ? 'en' : 'zh'

    await setSetting('resend_api_key', resendApiKey)
    await setSetting('resend_from_email', resendFromEmail)
    await setSetting('resend_from_name', resendFromName)
    await setSetting('resend_enabled', resendEnabled ? 'true' : 'false')
    await setSetting('email_language', emailLanguage)

    return {
        telegramBotToken: token,
        telegramChatId: chatId,
        telegramLanguage: language || 'zh',
        telegramEnabled,
        barkEnabled,
        barkServerUrl: barkServerUrl || 'https://api.day.app',
        barkDeviceKey,
        resendApiKey,
        resendFromEmail,
        resendFromName,
        resendEnabled,
        emailLanguage
    }
}

export async function testNotification() {
    await checkAdmin()
    return await sendTelegramMessage("🔔 Test notification from LDC Shop")
}

export async function testBarkNotification() {
    await checkAdmin()
    return await sendBarkMessage("🔔 Test notification from LDC Shop", "This is a test message from LDC Shop", {
        group: 'LDC Shop'
    })
}

export async function testEmailNotification(to: string) {
    await checkAdmin()
    const { testResendEmail } = await import("@/lib/email")
    return await testResendEmail(to)
}

async function ensureCategoriesTable() {
    await db.run(sql`
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            icon TEXT,
            sort_order INTEGER DEFAULT 0,
            created_at INTEGER DEFAULT (unixepoch() * 1000),
            updated_at INTEGER DEFAULT (unixepoch() * 1000)
        );
        CREATE UNIQUE INDEX IF NOT EXISTS categories_name_uq ON categories(name);
    `)
}

export async function saveCategory(formData: FormData) {
    await checkAdmin()
    await ensureCategoriesTable()

    const idRaw = formData.get('id') as string | null
    const name = String(formData.get('name') || '').trim()
    const icon = String(formData.get('icon') || '').trim() || null
    const sortOrder = Number.parseInt(String(formData.get('sortOrder') || '0'), 10) || 0
    if (!name) throw new Error("Category name is required")

    if (idRaw) {
        const id = Number.parseInt(idRaw, 10)
        await db.update(categories).set({ name, icon, sortOrder, updatedAt: new Date() }).where(eq(categories.id, id))
    } else {
        await db.insert(categories).values({ name, icon, sortOrder, updatedAt: new Date() })
    }

    revalidatePath('/admin/categories')
    revalidatePath('/')
    updateTag('home:categories')
    updateTag('home:products')
    updateTag('home:product-categories')
}

export async function deleteCategory(id: number) {
    await checkAdmin()
    await ensureCategoriesTable()
    await db.delete(categories).where(eq(categories.id, id))
    revalidatePath('/admin/categories')
    revalidatePath('/')
    updateTag('home:categories')
    updateTag('home:products')
    updateTag('home:product-categories')
}
