'use server'

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { products, cards, orders, loginUsers } from "@/lib/db/schema"
import { cancelExpiredOrders, cleanupExpiredCardsIfNeeded, recalcProductAggregates, createUserNotification } from "@/lib/db/queries"
import { generateOrderId, generateSign } from "@/lib/crypto"
import { eq, sql, and, or, isNull, lt, gt } from "drizzle-orm"
import { cookies } from "next/headers"
import { updateTag } from "next/cache"
import { after } from "next/server"
import { notifyAdminPaymentSuccess } from "@/lib/notifications"
import { sendOrderEmail } from "@/lib/email"
import { INFINITE_STOCK, RESERVATION_TTL_MS } from "@/lib/constants"
import { pullOneCardFromApi } from "@/lib/card-api"

const MAX_ORDER_QUANTITY = 10000
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isMissingColumnError(error: any) {
    const errorString = (JSON.stringify(error) + String(error) + (error?.message || '')).toLowerCase()
    return errorString.includes('no such column') || errorString.includes('column not found') || errorString.includes('d1_column_notfound')
}

function getMaxPointDeduction(totalAmount: number, quantity: number, maxPointsDiscount: string | number | null | undefined) {
    const rawLimit = typeof maxPointsDiscount === 'string' ? maxPointsDiscount.trim() : maxPointsDiscount
    if (rawLimit === null || rawLimit === undefined || rawLimit === '') {
        return Math.ceil(totalAmount)
    }

    const unitLimit = Number(rawLimit)
    if (!Number.isFinite(unitLimit) || unitLimit < 0) {
        return Math.ceil(totalAmount)
    }

    const cappedAmount = Math.min(totalAmount, unitLimit * quantity)
    if (cappedAmount >= totalAmount) {
        return Math.ceil(totalAmount)
    }

    return Math.floor(Math.max(0, cappedAmount))
}

function isValidEmail(value: string | null | undefined) {
    if (!value) return false
    return EMAIL_REGEX.test(value.trim())
}

async function autoReplenishByApi(productId: string, reason: string) {
    try {
        const result = await pullOneCardFromApi(productId)
        if (result.ok) {
            console.log(`[Card API] Auto replenished for product ${productId}, reason=${reason}`)
            return
        }
        if (result.skipped) {
            console.info(`[Card API] Auto replenish skipped for product ${productId}, reason=${reason}, detail=${result.error || "skipped"}`)
            return
        }
        console.warn(`[Card API] Auto replenish failed for product ${productId}, reason=${reason}, detail=${result.error || "unknown_error"}`)
    } catch (error: any) {
        console.warn(`[Card API] Auto replenish exception for product ${productId}, reason=${reason}, detail=${error?.message || "unknown_error"}`)
    }
}

export async function createOrder(productId: string, quantity: number = 1, email?: string, usePoints: boolean = false, answers?: string[]) {
    const session = await auth()
    const user = session?.user
    const normalizedQuantity = Number(quantity)

    if (!Number.isFinite(normalizedQuantity) || !Number.isInteger(normalizedQuantity) || normalizedQuantity <= 0) {
        return { success: false, error: 'buy.invalidQuantity' }
    }

    quantity = normalizedQuantity

    // 1. Get Product
    const getCheckoutProduct = async () => {
        const query = () => db.query.products.findFirst({
            where: eq(products.id, productId),
            columns: {
                id: true,
                name: true,
                price: true,
                purchaseLimit: true,
                maxPointsDiscount: true,
                isShared: true,
                purchaseQuestions: true
            }
        })

        try {
            return await query()
        } catch (error: any) {
            if (!isMissingColumnError(error)) throw error
            try {
                await db.run(sql.raw(`ALTER TABLE products ADD COLUMN max_points_discount TEXT`))
            } catch { /* column exists */ }
            return await query()
        }
    }
    const product = await getCheckoutProduct()
    if (!product) return { success: false, error: 'buy.productNotFound' }

    if (product.purchaseQuestions) {
        try {
            const qs: Array<{ q: string; a: string }> = JSON.parse(product.purchaseQuestions)
            if (Array.isArray(qs) && qs.length > 0) {
                if (!answers || answers.length !== qs.length) {
                    return { success: false, error: 'buy.answersRequired' }
                }
                const allCorrect = qs.every((q, i) => {
                    const userAnswer = (answers[i] || '').trim().toLowerCase()
                    return userAnswer === q.a.trim().toLowerCase()
                })
                if (!allCorrect) {
                    return { success: false, error: 'buy.questionsWrong' }
                }
            }
        } catch { /* malformed JSON, skip */ }
    }

    const purchaseLimit = product.purchaseLimit && product.purchaseLimit > 0 ? product.purchaseLimit : null
    const maxQuantity = purchaseLimit ?? MAX_ORDER_QUANTITY

    if (quantity > maxQuantity) {
        return { success: false, error: purchaseLimit ? 'buy.limitExceeded' : 'buy.quantityTooLarge' }
    }

    // 2. Check Blocked Status
    if (user?.id) {
        const userRec = await db.query.loginUsers.findFirst({
            where: eq(loginUsers.userId, user.id),
            columns: { isBlocked: true }
        });
        if (userRec?.isBlocked) {
            return { success: false, error: 'buy.userBlocked' };
        }
    }

    // Points Calculation
    let pointsToUse = 0
    let finalAmount = Number(product.price) * quantity

    if (usePoints && user?.id) {
        const userRec = await db.query.loginUsers.findFirst({
            where: eq(loginUsers.userId, user.id),
            columns: { points: true }
        })
        const currentPoints = userRec?.points || 0

        if (currentPoints > 0) {
            // Logic: 1 Point = 1 Unit of currency
            pointsToUse = Math.min(currentPoints, getMaxPointDeduction(finalAmount, quantity, product.maxPointsDiscount))
            finalAmount = Math.max(0, finalAmount - pointsToUse)
        }
    }

    const isZeroPrice = finalAmount <= 0
    const contactInfo = (email || '').trim()
    const resolvedContactInfo = contactInfo || null
    const resolvedDeliveryEmail = isValidEmail(contactInfo) ? contactInfo : null

    // 2. Check Stock
    const getAvailableStock = async () => {
        // For shared products, we just need ANY unused card to exist. Reservation status doesn't matter since we don't reserve.
        if (product.isShared) {
            const result = await db.select({ count: sql<number>`count(*)` })
                .from(cards)
                .where(and(
                    eq(cards.productId, productId),
                    or(isNull(cards.isUsed), eq(cards.isUsed, false))
                ));
            // If we have at least 1 card, treat as infinite stock
            return (result[0]?.count || 0) > 0 ? INFINITE_STOCK : 0;
        }

        // SQLite count returns number directly usually
        const result = await db.select({ count: sql<number>`count(*)` })
            .from(cards)
            .where(and(
                eq(cards.productId, productId),
                or(isNull(cards.isUsed), eq(cards.isUsed, false)),
                or(isNull(cards.reservedAt), lt(cards.reservedAt, new Date(Date.now() - RESERVATION_TTL_MS)))
            ))
        return result[0]?.count || 0
    }

    const runStockCleanupFallback = async () => {
        await Promise.allSettled([
            cleanupExpiredCardsIfNeeded(0, productId),
            cancelExpiredOrders({ productId }),
        ])
    }

    let stock = await getAvailableStock()
    if (stock < quantity) {
        await runStockCleanupFallback()
        stock = await getAvailableStock()
    }

    if (stock < quantity) return { success: false, error: 'buy.outOfStock' }

    // 3. Check Purchase Limit
    if (product.purchaseLimit && product.purchaseLimit > 0) {
        const currentUserId = user?.id
        const currentUserEmail = resolvedDeliveryEmail || user?.email || null

        if (currentUserId || currentUserEmail) {
            const conditions = [eq(orders.productId, productId)]
            const userConditions = []

            if (currentUserId) userConditions.push(eq(orders.userId, currentUserId))
            if (currentUserEmail) userConditions.push(eq(orders.email, currentUserEmail))

            if (userConditions.length > 0) {
                const countResult = await db.select({
                    totalQuantity: sql<number>`coalesce(sum(${orders.quantity}), count(*))`
                })
                    .from(orders)
                    .where(and(
                        eq(orders.productId, productId),
                        or(...userConditions),
                        or(eq(orders.status, 'paid'), eq(orders.status, 'delivered'))
                    ))

                const existingCount = countResult[0]?.totalQuantity || 0
                if (existingCount + quantity > product.purchaseLimit) {
                    return { success: false, error: 'buy.limitExceeded' }
                }
            }
        }
    }

    // 4. Create Order + Reserve Stock (1 minute) OR Deliver Immediately
    const orderId = generateOrderId()

    const reserveAndCreate = async () => {
        const { queryOrderStatus } = await import("@/lib/epay")

        const reservedCards: { id: number, key: string }[] = []

        // If shared product, SKIP reservation logic. We just confirm we have stock (already checked above)
        if (product.isShared) {
            // For shared products, we don't lock cards. We just proceed.
            // But we need to pass a valid key to 'createOrderRecord' if it's a zero-price order for immediate fulfillment?
            // Actually createOrderRecord handles fulfillment logic slightly differently for zero price.
            // If zero price + shared => we need to grab a key NOW to deliver it?

            // However, createOrderRecord logic (lines 246-256) marks cards as USED if zero price. 
            // We MUST careful with shared products + zero price.

            // Let's grab ONE key for reference (randomly) just in case
            const nowMs = Date.now()
            const availableCard = await db.select({ id: cards.id, cardKey: cards.cardKey })
                .from(cards)
                .where(and(
                    eq(cards.productId, productId),
                    or(isNull(cards.isUsed), eq(cards.isUsed, false)),
                    or(isNull(cards.expiresAt), gt(cards.expiresAt, new Date(nowMs)))
                ))
                .orderBy(sql`RANDOM()`)
                .limit(1);

            if (availableCard.length > 0) {
                // We push the SAME key 'quantity' times
                for (let i = 0; i < quantity; i++) {
                    reservedCards.push({ id: availableCard[0].id, key: availableCard[0].cardKey });
                }
            } else {
                throw new Error('stock_locked') // Should be caught by stock check, but race condition possible
            }

            // We do NOT update DB to reserve.
        } else {
            // Normal Product Reservation Logic
            for (let i = 0; i < quantity; i++) {
                let attempts = 0
                const maxAttempts = 3
                let success = false

                while (attempts < maxAttempts && !success) {
                    attempts++

                    // A. Try strictly free card (single atomic UPDATE ... RETURNING)
                    const nowMs = Date.now();
                    const claimResult: any = await db.run(sql`
                        UPDATE cards
                        SET reserved_order_id = ${orderId}, reserved_at = ${nowMs}
                        WHERE id = (
                            SELECT id FROM cards
                            WHERE product_id = ${productId}
                              AND (is_used = 0 OR is_used IS NULL)
                              AND reserved_at IS NULL
                              AND (expires_at IS NULL OR expires_at > ${nowMs})
                            LIMIT 1
                        )
                        RETURNING id, card_key
                    `);

                    const claimedRows = claimResult?.results || claimResult?.rows || [];
                    if (claimedRows.length > 0) {
                        const row = claimedRows[0];
                        const id = Number(row.id);
                        const key = row.card_key ?? row.cardKey;
                        reservedCards.push({ id, key });
                        success = true;
                        continue;
                    }

                    // B. Fallback: Expired reservation
                    const fiveMinutesAgo = new Date(Date.now() - RESERVATION_TTL_MS);
                    const nowMsExpired = Date.now();
                    const expiredCandidates = await db.select({
                        id: cards.id,
                        cardKey: cards.cardKey,
                        reservedOrderId: cards.reservedOrderId
                    })
                        .from(cards)
                        .where(and(
                            eq(cards.productId, productId),
                            or(eq(cards.isUsed, false), isNull(cards.isUsed)),
                            lt(cards.reservedAt, fiveMinutesAgo),
                            or(isNull(cards.expiresAt), gt(cards.expiresAt, new Date(nowMsExpired)))
                        ))
                        .limit(1);

                    if (expiredCandidates.length === 0) {
                        break
                    }

                    const candidate = expiredCandidates[0]
                    const candidateCardId = candidate.id
                    const candidateOrderId = candidate.reservedOrderId

                    let isPaid = false
                    try {
                        if (candidateOrderId) {
                            const statusRes = await queryOrderStatus(candidateOrderId)
                            if (statusRes.success && statusRes.status === 1) {
                                isPaid = true
                            }
                        }
                    } catch {
                        // ignore
                    }

                    if (isPaid) {
                        await db.update(cards)
                            .set({ isUsed: true, usedAt: new Date() })
                            .where(eq(cards.id, candidateCardId));
                        await db.update(orders)
                            .set({ status: 'paid', paidAt: new Date() })
                            .where(and(eq(orders.orderId, candidateOrderId!), eq(orders.status, 'pending')));
                        continue
                    } else {
                        // Steal the expired card only if it is still expired and unchanged
                        const now = new Date();
                        const updated = await db.update(cards)
                            .set({ reservedOrderId: orderId, reservedAt: now })
                            .where(and(
                                eq(cards.id, candidateCardId),
                                or(eq(cards.isUsed, false), isNull(cards.isUsed)),
                                lt(cards.reservedAt, fiveMinutesAgo),
                                candidateOrderId
                                    ? eq(cards.reservedOrderId, candidateOrderId)
                                    : isNull(cards.reservedOrderId)
                            ))
                            .returning({ id: cards.id, cardKey: cards.cardKey });

                        if (updated.length > 0) {
                            reservedCards.push({ id: updated[0].id, key: updated[0].cardKey });
                            success = true;
                        }
                    }
                } // end while

                if (!success) {
                    throw new Error('stock_locked')
                }
            } // end for
        }

        const joinedKeys = reservedCards.map(c => c.key).join('\n')

        await createOrderRecord(reservedCards, joinedKeys, isZeroPrice, pointsToUse, finalAmount, user, session?.user?.username, resolvedContactInfo, product, orderId, quantity)
    };

    const createOrderRecord = async (reservedCards: any[], joinedKeys: string, isZeroPrice: boolean, pointsToUse: number, finalAmount: number, user: any, canonicalUsername: any, contactInfo: any, product: any, orderId: string, qty: number) => {
        let pointsDeducted = false
        let orderInserted = false
        const normalizedUsername = canonicalUsername || user?.username || user?.name || null

        try {
            if (pointsToUse > 0) {
                const updatedUser = await db.update(loginUsers)
                    .set({ points: sql`${loginUsers.points} - ${pointsToUse}` })
                    .where(and(eq(loginUsers.userId, user!.id!), sql`${loginUsers.points} >= ${pointsToUse}`))
                    .returning({ points: loginUsers.points });

                if (!updatedUser.length) {
                    throw new Error('insufficient_points');
                }

                pointsDeducted = true
            }

            const uniqueCardIds = Array.from(new Set(reservedCards.map(c => c.id).filter((id: any) => id !== null && id !== undefined)));
            const cardIdsValue = uniqueCardIds.length > 0 ? uniqueCardIds.join(',') : null;

            if (isZeroPrice) {
                const cardIds = reservedCards.map(c => c.id)
                if (cardIds.length > 0) {
                    if (product.isShared) {
                        // For shared products, DO NOT mark as used.
                        // Just update order status (below)
                    } else {
                        for (const cid of cardIds) {
                            await db.update(cards).set({
                                isUsed: true,
                                usedAt: new Date(),
                                reservedOrderId: null,
                                reservedAt: null
                            }).where(eq(cards.id, cid));
                        }
                    }
                }

                await db.insert(orders).values({
                    orderId,
                    productId: product.id,
                    productName: product.name,
                    amount: finalAmount.toString(),
                    email: resolvedContactInfo,
                    userId: user?.id || null,
                    username: normalizedUsername,
                    status: 'delivered',
                    cardKey: joinedKeys,
                    cardIds: cardIdsValue,
                    paidAt: new Date(),
                    deliveredAt: new Date(),
                    tradeNo: 'POINTS_REDEMPTION',
                    pointsUsed: pointsToUse,
                    quantity: qty,
                    createdAt: new Date()
                });
                orderInserted = true

                if (user?.id) {
                    try {
                        await createUserNotification({
                            userId: user.id,
                            type: 'order_delivered',
                            titleKey: 'profile.notifications.orderDeliveredTitle',
                            contentKey: 'profile.notifications.orderDeliveredBody',
                            data: {
                                params: {
                                    orderId,
                                    productName: product.name
                                },
                                href: `/order/${orderId}`
                            }
                        })
                    } catch {
                        // best effort
                    }
                }

                if (!product.isShared && !!cardIdsValue) {
                    await autoReplenishByApi(product.id, `order:${orderId}:zero_price`)
                }

                after(async () => {
                    // Notify admin for points-only payment
                    console.log('[Checkout] Points payment completed, sending notification for order:', orderId);
                    try {
                        await notifyAdminPaymentSuccess({
                            orderId,
                            productName: product.name,
                            amount: pointsToUse.toString() + ' (积分)',
                            username: normalizedUsername,
                            email: contactInfo || user?.email,
                            tradeNo: 'POINTS_REDEMPTION'
                        });
                        console.log('[Checkout] Points payment notification sent successfully');
                    } catch (err) {
                        console.error('[Notification] Points payment notify failed:', err);
                    }

                    // Send email with card keys
                    const orderEmail = resolvedDeliveryEmail;
                    if (orderEmail) {
                        await sendOrderEmail({
                            to: orderEmail,
                            orderId,
                            productName: product.name,
                            cardKeys: joinedKeys
                        }).catch(err => console.error('[Email] Points payment email failed:', err));
                    }
                })

            } else {
                await db.insert(orders).values({
                    orderId,
                    productId: product.id,
                    productName: product.name,
                    amount: finalAmount.toString(),
                    email: resolvedContactInfo,
                    userId: user?.id || null,
                    username: normalizedUsername,
                    status: 'pending',
                    pointsUsed: pointsToUse,
                    currentPaymentId: orderId, // Store current payment ID
                    cardIds: cardIdsValue,
                    quantity: qty,
                    createdAt: new Date()
                });
                orderInserted = true
            }
        } catch (error) {
            if (pointsDeducted && !orderInserted && user?.id) {
                try {
                    await db.update(loginUsers)
                        .set({ points: sql`${loginUsers.points} + ${pointsToUse}` })
                        .where(eq(loginUsers.userId, user.id))
                } catch {
                    // Best effort rollback
                }
            }
            throw error;
        }
    }

    try {
        await reserveAndCreate();
        try {
            await recalcProductAggregates(productId)
        } catch {
            // best effort
        }
        try {
            updateTag('home:products')
        } catch {
            // best effort
        }
    } catch (error: any) {
        if (error?.message === 'stock_locked') {
            return { success: false, error: 'buy.stockLocked' };
        }
        if (error?.message === 'insufficient_points') {
            return { success: false, error: 'Points mismatch, please try again.' };
        }
        throw error;
    }

    if (isZeroPrice) {
        return {
            success: true,
            url: `${process.env.NEXT_PUBLIC_APP_URL || ''}/order/${orderId}`,
            isZeroPrice: true
        }
    }

    const cookieStore = await cookies()
    cookieStore.set('ldc_pending_order', orderId, { secure: true, path: '/', sameSite: 'lax' })

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const payParams: Record<string, any> = {
        pid: process.env.MERCHANT_ID!,
        type: 'epay',
        out_trade_no: orderId,
        notify_url: `${baseUrl}/api/notify`,
        return_url: `${baseUrl}/callback/${orderId}`,
        name: product.name,
        money: Number(finalAmount).toFixed(2),
        sign_type: 'MD5'
    }

    payParams.sign = generateSign(payParams, process.env.MERCHANT_KEY!)

    return {
        success: true,
        url: process.env.PAY_URL || 'https://credit.linux.do/epay/pay/submit.php',
        params: payParams
    }
}

export async function getRetryPaymentParams(orderId: string) {
    const session = await auth()
    const user = session?.user

    if (!user?.id) return { success: false, error: 'common.error' }

    const order = await db.query.orders.findFirst({
        where: and(eq(orders.orderId, orderId), eq(orders.userId, user.id))
    })

    if (!order) return { success: false, error: 'buy.productNotFound' }
    if (order.status !== 'pending') return { success: false, error: 'order.status.paid' }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

    const uniqueTradeNo = `${order.orderId}_retry${Date.now()}`;

    await db.update(orders)
        .set({ currentPaymentId: uniqueTradeNo })
        .where(eq(orders.orderId, orderId))

    const payParams: Record<string, any> = {
        pid: process.env.MERCHANT_ID!,
        type: 'epay',
        out_trade_no: uniqueTradeNo,
        notify_url: `${baseUrl}/api/notify`,
        return_url: `${baseUrl}/callback/${order.orderId}`,
        name: order.productName,
        money: Number(order.amount).toFixed(2),
        sign_type: 'MD5'
    }

    payParams.sign = generateSign(payParams, process.env.MERCHANT_KEY!)

    return {
        success: true,
        url: process.env.PAY_URL || 'https://credit.linux.do/epay/pay/submit.php',
        params: payParams
    }
}
