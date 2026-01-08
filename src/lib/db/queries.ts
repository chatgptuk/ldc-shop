import { db } from "./index";
import { products, cards, orders, settings, reviews, loginUsers, categories } from "./schema";
import { eq, sql, desc, and, asc, gte, or } from "drizzle-orm";

async function ensureProductsColumns() {
    await db.execute(sql`
        ALTER TABLE products ADD COLUMN IF NOT EXISTS compare_at_price DECIMAL(10, 2);
        ALTER TABLE products ADD COLUMN IF NOT EXISTS is_hot BOOLEAN DEFAULT FALSE;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS single_card_only BOOLEAN DEFAULT FALSE;
    `)
}

async function ensureOrdersColumns() {
    await db.execute(sql`
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS points_used INTEGER DEFAULT 0 NOT NULL;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS original_amount DECIMAL(10, 2);
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_code TEXT;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10, 2);
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_adjusted_from DECIMAL(10, 2);
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_adjusted_by TEXT;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_adjusted_reason TEXT;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_adjusted_at TIMESTAMP;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS card_keys TEXT;
    `)
}

async function withProductColumnFallback<T>(fn: () => Promise<T>): Promise<T> {
    try {
        return await fn()
    } catch (error: any) {
        const errorString = JSON.stringify(error)
        if (errorString.includes('42703')) {
            await ensureProductsColumns()
            return await fn()
        }
        throw error
    }
}

async function withOrderColumnFallback<T>(fn: () => Promise<T>): Promise<T> {
    try {
        return await fn()
    } catch (error: any) {
        if (isMissingTableOrColumn(error)) {
            await ensureOrdersColumns()
            return await fn()
        }
        throw error
    }
}

export async function getProducts() {
    return await withProductColumnFallback(async () => {
        return await db.select({
            id: products.id,
            name: products.name,
            description: products.description,
            price: products.price,
            compareAtPrice: products.compareAtPrice,
            image: products.image,
            category: products.category,
            isHot: products.isHot,
            isActive: products.isActive,
            sortOrder: products.sortOrder,
            purchaseLimit: products.purchaseLimit,
                singleCardOnly: products.singleCardOnly,
            stock: sql<number>`count(case when COALESCE(${cards.isUsed}, false) = false AND (${cards.reservedAt} IS NULL OR ${cards.reservedAt} < NOW() - INTERVAL '1 minute') then 1 end):: int`,
            sold: sql<number>`count(case when COALESCE(${cards.isUsed}, false) = true then 1 end):: int`
        })
            .from(products)
            .leftJoin(cards, eq(products.id, cards.productId))
            .groupBy(products.id)
            .orderBy(asc(products.sortOrder), desc(products.createdAt));
    })
}

// Get only active products (for home page)
export async function getActiveProducts() {
    return await withProductColumnFallback(async () => {
        return await db.select({
            id: products.id,
            name: products.name,
            description: products.description,
            price: products.price,
            compareAtPrice: products.compareAtPrice,
            image: products.image,
            category: products.category,
            isHot: products.isHot,
                purchaseLimit: products.purchaseLimit,
                singleCardOnly: products.singleCardOnly,
            stock: sql<number>`count(case when COALESCE(${cards.isUsed}, false) = false AND (${cards.reservedAt} IS NULL OR ${cards.reservedAt} < NOW() - INTERVAL '1 minute') then 1 end):: int`,
            sold: sql<number>`count(case when COALESCE(${cards.isUsed}, false) = true then 1 end):: int`
        })
            .from(products)
            .leftJoin(cards, eq(products.id, cards.productId))
            .where(eq(products.isActive, true))
            .groupBy(products.id)
            .orderBy(asc(products.sortOrder), desc(products.createdAt));
    })
}

export async function getProduct(id: string) {
    return await withProductColumnFallback(async () => {
        const result = await db.select({
            id: products.id,
            name: products.name,
            description: products.description,
            price: products.price,
            compareAtPrice: products.compareAtPrice,
            image: products.image,
            category: products.category,
            isHot: products.isHot,
            purchaseLimit: products.purchaseLimit,
                singleCardOnly: products.singleCardOnly,
            stock: sql<number>`count(case when COALESCE(${cards.isUsed}, false) = false AND (${cards.reservedAt} IS NULL OR ${cards.reservedAt} < NOW() - INTERVAL '1 minute') then 1 end):: int`
        })
            .from(products)
            .leftJoin(cards, eq(products.id, cards.productId))
            .where(eq(products.id, id))
            .groupBy(products.id);

        return result[0];
    })
}

// Dashboard Stats
export async function getDashboardStats() {
    return await withOrderColumnFallback(async () => {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekStart = new Date(todayStart);
        weekStart.setDate(weekStart.getDate() - 7);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        // Get all delivered orders
        const allOrders = await db.query.orders.findMany({
            where: eq(orders.status, 'delivered')
        });

        const todayOrders = allOrders.filter(o => o.paidAt && new Date(o.paidAt) >= todayStart);
        const weekOrders = allOrders.filter(o => o.paidAt && new Date(o.paidAt) >= weekStart);
        const monthOrders = allOrders.filter(o => o.paidAt && new Date(o.paidAt) >= monthStart);

        const sumAmount = (orders: typeof allOrders) =>
            orders.reduce((sum, o) => sum + parseFloat(o.amount), 0);

        return {
            today: { count: todayOrders.length, revenue: sumAmount(todayOrders) },
            week: { count: weekOrders.length, revenue: sumAmount(weekOrders) },
            month: { count: monthOrders.length, revenue: sumAmount(monthOrders) },
            total: { count: allOrders.length, revenue: sumAmount(allOrders) }
        };
    })
}

export async function getRecentOrders(limit: number = 10) {
    return await withOrderColumnFallback(async () => {
        return await db.query.orders.findMany({
            orderBy: [desc(orders.createdAt)],
            limit
        })
    })
}

// Settings
export async function getSetting(key: string): Promise<string | null> {
    const result = await db.select({ value: settings.value })
        .from(settings)
        .where(eq(settings.key, key));
    return result[0]?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
    await db.insert(settings)
        .values({ key, value, updatedAt: new Date() })
        .onConflictDoUpdate({
            target: settings.key,
            set: { value, updatedAt: new Date() }
        });
}

// Categories (best-effort; table created on demand)
async function ensureCategoriesTable() {
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS categories(
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        icon TEXT,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
    );
        CREATE UNIQUE INDEX IF NOT EXISTS categories_name_uq ON categories(name);
    `)
}

export async function getCategories(): Promise<Array<{ id: number; name: string; icon: string | null; sortOrder: number }>> {
    try {
        const rows = await db.select({
            id: categories.id,
            name: categories.name,
            icon: categories.icon,
            sortOrder: sql<number>`COALESCE(${categories.sortOrder}, 0):: int`,
        }).from(categories).orderBy(asc(categories.sortOrder), asc(categories.name))
        return rows
    } catch (error: any) {
        if (isMissingTable(error)) {
            await ensureCategoriesTable()
            return []
        }
        throw error
    }
}

export async function searchActiveProducts(params: {
    q?: string
    category?: string
    sort?: string
    page?: number
    pageSize?: number
}) {
    const q = (params.q || '').trim()
    const category = (params.category || '').trim()
    const sort = (params.sort || 'default').trim()
    const page = params.page && params.page > 0 ? params.page : 1
    const pageSize = Math.min(params.pageSize && params.pageSize > 0 ? params.pageSize : 24, 60)
    const offset = (page - 1) * pageSize

    const whereParts: any[] = [eq(products.isActive, true)]
    if (category && category !== 'all') whereParts.push(eq(products.category, category))
    if (q) {
        const like = `% ${q}% `
        whereParts.push(or(
            sql`${products.name} ILIKE ${like} `,
            sql`COALESCE(${products.description}, '') ILIKE ${like} `
        ))
    }
    const whereExpr = and(...whereParts)

    const orderByParts: any[] = []
    switch (sort) {
        case 'priceAsc':
            orderByParts.push(asc(products.price))
            break
        case 'priceDesc':
            orderByParts.push(desc(products.price))
            break
        case 'stockDesc':
            orderByParts.push(desc(sql<number>`count(case when ${cards.isUsed} = false then 1 end):: int`))
            break
        case 'soldDesc':
            orderByParts.push(desc(sql<number>`count(case when ${cards.isUsed} = true then 1 end):: int`))
            break
        case 'hot':
            orderByParts.push(desc(sql<number>`case when ${products.isHot} = true then 1 else 0 end`))
            orderByParts.push(asc(products.sortOrder), desc(products.createdAt))
            break
        default:
            orderByParts.push(asc(products.sortOrder), desc(products.createdAt))
            break
    }

    const [items, totalRes] = await withProductColumnFallback(async () => {
        const rowsPromise = db.select({
            id: products.id,
            name: products.name,
            description: products.description,
            price: products.price,
            compareAtPrice: products.compareAtPrice,
            image: products.image,
            category: products.category,
            isHot: products.isHot,
            purchaseLimit: products.purchaseLimit,
                singleCardOnly: products.singleCardOnly,
            stock: sql<number>`count(case when COALESCE(${cards.isUsed}, false) = false AND (${cards.reservedAt} IS NULL OR ${cards.reservedAt} < NOW() - INTERVAL '1 minute') then 1 end):: int`,
            sold: sql<number>`count(case when COALESCE(${cards.isUsed}, false) = true then 1 end):: int`
        })
            .from(products)
            .leftJoin(cards, eq(products.id, cards.productId))
            .where(whereExpr)
            .groupBy(products.id)
            .orderBy(...orderByParts)
            .limit(pageSize)
            .offset(offset)

        const countQuery = db.select({ count: sql<number>`count(*):: int` }).from(products).where(whereExpr)
        return Promise.all([rowsPromise, countQuery])
    })

    return {
        items,
        total: totalRes[0]?.count || 0,
        page,
        pageSize,
    }
}

// Reviews
export async function getProductReviews(productId: string) {
    return await db.select()
        .from(reviews)
        .where(eq(reviews.productId, productId))
        .orderBy(desc(reviews.createdAt));
}

export async function getProductRating(productId: string): Promise<{ average: number; count: number }> {
    const result = await db.select({
        avg: sql<number>`COALESCE(AVG(${reviews.rating}), 0):: float`,
        count: sql<number>`COUNT(*):: int`
    })
        .from(reviews)
        .where(eq(reviews.productId, productId));

    return {
        average: result[0]?.avg ?? 0,
        count: result[0]?.count ?? 0
    };
}

export async function createReview(data: {
    productId: string;
    orderId: string;
    userId: string;
    username: string;
    rating: number;
    comment?: string;
}) {
    return await db.insert(reviews).values({
        ...data,
        createdAt: new Date()
    }).returning();
}

export async function canUserReview(userId: string, productId: string, username?: string): Promise<{ canReview: boolean; orderId?: string }> {
    try {
        // Check by userId first
        let deliveredOrders = await db.select({ orderId: orders.orderId })
            .from(orders)
            .where(and(
                eq(orders.userId, userId),
                eq(orders.productId, productId),
                eq(orders.status, 'delivered')
            ));

        // If no orders found by userId, try by username
        if (deliveredOrders.length === 0 && username) {
            deliveredOrders = await db.select({ orderId: orders.orderId })
                .from(orders)
                .where(and(
                    eq(orders.username, username),
                    eq(orders.productId, productId),
                    eq(orders.status, 'delivered')
                ));
        }

        if (deliveredOrders.length === 0) {
            return { canReview: false };
        }

        // Find the first order that hasn't been reviewed yet
        for (const order of deliveredOrders) {
            try {
                const existingReview = await db.select({ id: reviews.id })
                    .from(reviews)
                    .where(eq(reviews.orderId, order.orderId));

                if (existingReview.length === 0) {
                    // This order hasn't been reviewed yet
                    return { canReview: true, orderId: order.orderId };
                }
            } catch {
                // Reviews table might not exist, so user can review
                return { canReview: true, orderId: order.orderId };
            }
        }

        // All orders have been reviewed
        return { canReview: false };
    } catch (error) {
        console.error('canUserReview error:', error);
        return { canReview: false };
    }
}

export async function hasUserReviewedOrder(orderId: string): Promise<boolean> {
    const result = await db.select({ id: reviews.id })
        .from(reviews)
        .where(eq(reviews.orderId, orderId));
    return result.length > 0;
}

function isMissingTable(error: any) {
    const errorString = JSON.stringify(error);
    return (
        error?.message?.includes('does not exist') ||
        error?.cause?.message?.includes('does not exist') ||
        errorString.includes('42P01') ||
        (errorString.includes('relation') && errorString.includes('does not exist'))
    );
}

function isMissingTableOrColumn(error: any) {
    const errorString = JSON.stringify(error);
    return isMissingTable(error) || errorString.includes('42703');
}

async function ensureLoginUsersTable() {
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS login_users(
        user_id TEXT PRIMARY KEY,
        username TEXT,
        points INTEGER DEFAULT 0 NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        last_login_at TIMESTAMP DEFAULT NOW()
    )
        `);
}

async function ensureSettingsTable() {
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS settings(
            key TEXT PRIMARY KEY,
            value TEXT,
            updated_at TIMESTAMP DEFAULT NOW()
        )
        `);
}

async function isLoginUsersBackfilled(): Promise<boolean> {
    try {
        const result = await db.select({ value: settings.value })
            .from(settings)
            .where(eq(settings.key, 'login_users_backfilled'));
        return result[0]?.value === '1';
    } catch (error: any) {
        if (isMissingTable(error)) {
            await ensureSettingsTable();
            return false;
        }
        throw error;
    }
}

async function markLoginUsersBackfilled() {
    await db.insert(settings).values({
        key: 'login_users_backfilled',
        value: '1',
        updatedAt: new Date()
    }).onConflictDoUpdate({
        target: settings.key,
        set: { value: '1', updatedAt: new Date() }
    });
}

async function backfillLoginUsersFromOrdersAndReviews() {
    const alreadyBackfilled = await isLoginUsersBackfilled();
    if (alreadyBackfilled) return;

    await ensureLoginUsersTable();

    try {
        await db.execute(sql`
            INSERT INTO login_users(user_id, username, created_at, last_login_at)
            SELECT user_id, MAX(username) AS username, NOW(), NOW()
    FROM(
        SELECT user_id, username
                FROM orders
                WHERE user_id IS NOT NULL AND user_id <> ''
                UNION ALL
                SELECT user_id, username
                FROM reviews
                WHERE user_id IS NOT NULL AND user_id <> ''
    ) AS users
            GROUP BY user_id
            ON CONFLICT(user_id) DO NOTHING
        `);
    } catch (error: any) {
        if (isMissingTable(error)) return;
        throw error;
    }

    await markLoginUsersBackfilled();
}

export async function recordLoginUser(userId: string, username?: string | null) {
    if (!userId) return;

    try {
        await db.insert(loginUsers).values({
            userId,
            username: username || null,
            lastLoginAt: new Date()
        }).onConflictDoUpdate({
            target: loginUsers.userId,
            set: { username: username || null, lastLoginAt: new Date() }
        });
    } catch (error: any) {
        if (isMissingTable(error) || error?.code === '42703' || error?.message?.includes('column')) {
            await ensureLoginUsersTable();
            // Ensure points column exists for existing tables
            try {
                await db.execute(sql`ALTER TABLE login_users ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 0 NOT NULL; `);
            } catch {
                // Ignore if it fails (e.g. column exists)
            }

            await db.insert(loginUsers).values({
                userId,
                username: username || null,
                lastLoginAt: new Date()
            }).onConflictDoUpdate({
                target: loginUsers.userId,
                set: { username: username || null, lastLoginAt: new Date() }
            });
            return;
        }
        console.error('recordLoginUser error:', error);
    }
}

export async function getVisitorCount(): Promise<number> {
    try {
        await backfillLoginUsersFromOrdersAndReviews();
        const result = await db.select({ count: sql<number>`count(*):: int` })
            .from(loginUsers);
        return result[0]?.count || 0;
    } catch (error: any) {
        if (isMissingTable(error)) return 0;
        throw error;
    }
}

export async function cancelExpiredOrders(filters: { productId?: string; userId?: string; orderId?: string } = {}) {
    const productId = filters.productId ?? null;
    const userId = filters.userId ?? null;
    const orderId = filters.orderId ?? null;

    try {
        return await db.transaction(async (tx) => {
            const expired = await tx.execute(sql`
                UPDATE orders
                SET status = 'cancelled'
                WHERE status = 'pending'
                  AND created_at < NOW() - INTERVAL '5 minutes'
    AND(${productId}:: text IS NULL OR product_id = ${productId})
    AND(${userId}:: text IS NULL OR user_id = ${userId})
    AND(${orderId}:: text IS NULL OR order_id = ${orderId})
                RETURNING order_id
        `);

            const orderIds = (expired.rows || []).map((row: any) => row.order_id as string).filter(Boolean);
            if (!orderIds.length) return orderIds;

            try {
                await tx.execute(sql`
                    ALTER TABLE cards ADD COLUMN IF NOT EXISTS reserved_order_id TEXT;
                    ALTER TABLE cards ADD COLUMN IF NOT EXISTS reserved_at TIMESTAMP;
    `);
            } catch (error: any) {
                if (!isMissingTableOrColumn(error)) throw error;
                return orderIds;
            }

            for (const expiredOrderId of orderIds) {
                try {
                    await tx.execute(sql`
                        UPDATE cards
                        SET reserved_order_id = NULL, reserved_at = NULL
                        WHERE reserved_order_id = ${expiredOrderId} AND COALESCE(is_used, false) = false
        `);
                } catch (error: any) {
                    if (!isMissingTableOrColumn(error)) throw error;
                    return orderIds;
                }
            }

            return orderIds;
        });
    } catch (error: any) {
        if (isMissingTableOrColumn(error)) return [];
        throw error;
    }
}

// Customer Management
export async function getUsers(page = 1, pageSize = 20, q = '') {
    const offset = (page - 1) * pageSize
    const search = q.trim()

    try {
        await backfillLoginUsersFromOrdersAndReviews();
        await ensureLoginUsersTable();

        let whereClause = undefined
        if (search) {
            const like = `%${search}%`
            whereClause = or(
                sql`${loginUsers.username} ILIKE ${like}`,
                sql`${loginUsers.userId} ILIKE ${like}`
            )
        }

        const itemsPromise = db.select({
            userId: loginUsers.userId,
            username: loginUsers.username,
            points: loginUsers.points,
            lastLoginAt: loginUsers.lastLoginAt,
            createdAt: loginUsers.createdAt,
            orderCount: sql<number>`count(CASE WHEN ${orders.status} IN ('paid', 'delivered', 'refunded') THEN 1 END)::int`
        })
            .from(loginUsers)
            .leftJoin(orders, eq(loginUsers.userId, orders.userId))
            .where(whereClause)
            .groupBy(loginUsers.userId)
            .orderBy(desc(loginUsers.lastLoginAt))
            .limit(pageSize)
            .offset(offset)

        const countQuery = db.select({ count: sql<number>`count(DISTINCT ${loginUsers.userId})::int` })
            .from(loginUsers)
            .where(whereClause)

        const [items, totalRes] = await Promise.all([itemsPromise, countQuery])

        return {
            items,
            total: totalRes[0]?.count || 0,
            page,
            pageSize
        }
    } catch (error: any) {
        if (isMissingTable(error)) {
            return { items: [], total: 0, page, pageSize }
        }
        throw error
    }
}

export async function updateUserPoints(userId: string, points: number) {
    await ensureLoginUsersTable();
    await db.update(loginUsers)
        .set({ points })
        .where(eq(loginUsers.userId, userId));
}
