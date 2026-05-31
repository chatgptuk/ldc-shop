import { db, dbExecRaw } from "./index";
import { products, cards, orders, settings, reviews, loginUsers, categories, userNotifications, wishlistItems, wishlistVotes } from "./schema";
import { INFINITE_STOCK, RESERVATION_TTL_MS } from "@/lib/constants";
import { eq, sql, desc, and, asc, gte, or, inArray, lte, lt, isNull } from "drizzle-orm";
import { updateTag, revalidatePath } from "next/cache";
import { cache } from "react";

// Database initialization state
let dbInitialized = false;
let loginUsersSchemaReady = false;
let wishlistTablesReady = false;
const CURRENT_SCHEMA_VERSION = 19;
type ColumnEnsureKey = 'products' | 'orders' | 'cards' | 'loginUsers';
const columnEnsureState: Record<ColumnEnsureKey, { ready: boolean; pending: Promise<void> | null }> = {
    products: { ready: false, pending: null },
    orders: { ready: false, pending: null },
    cards: { ready: false, pending: null },
    loginUsers: { ready: false, pending: null },
};

async function ensureColumnsOnce(key: ColumnEnsureKey, task: () => Promise<void>) {
    const state = columnEnsureState[key];
    if (state.ready) return;
    if (state.pending) {
        await state.pending;
        return;
    }
    const pending = (async () => {
        await task();
        state.ready = true;
    })();
    state.pending = pending;
    try {
        await pending;
    } finally {
        state.pending = null;
    }
}

async function ensureCardKeyDuplicatesAllowed() {
    try {
        await db.run(sql`DROP INDEX IF EXISTS cards_product_id_card_key_uq;`);
    } catch {
        // best effort
    }
}

async function safeAddColumn(table: string, column: string, definition: string) {
    try {
        await db.run(sql.raw(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`));
    } catch (e: any) {
        const msg = ((e?.message || '') + (e?.cause?.message || '') + String(e)).toLowerCase();
        if (!msg.includes('duplicate column')) throw e;
    }
}

async function ensureIndexes() {
    // ... existing index logic unchanged ...
    const indexStatements = [
        `CREATE INDEX IF NOT EXISTS products_active_sort_idx ON products(is_active, sort_order, created_at)`,
        `CREATE INDEX IF NOT EXISTS products_stock_count_idx ON products(stock_count)`,
        `CREATE INDEX IF NOT EXISTS products_sold_count_idx ON products(sold_count)`,
        `CREATE INDEX IF NOT EXISTS cards_product_used_reserved_idx ON cards(product_id, is_used, reserved_at)`,
        `CREATE INDEX IF NOT EXISTS cards_reserved_order_idx ON cards(reserved_order_id)`,
        `CREATE INDEX IF NOT EXISTS cards_expires_at_idx ON cards(expires_at)`,
        `CREATE INDEX IF NOT EXISTS orders_status_paid_at_idx ON orders(status, paid_at)`,
        `CREATE INDEX IF NOT EXISTS orders_status_created_at_idx ON orders(status, created_at)`,
        `CREATE INDEX IF NOT EXISTS orders_user_status_created_at_idx ON orders(user_id, status, created_at)`,
        `CREATE INDEX IF NOT EXISTS orders_product_status_idx ON orders(product_id, status)`,
        `CREATE INDEX IF NOT EXISTS reviews_product_created_at_idx ON reviews(product_id, created_at)`,
        `CREATE INDEX IF NOT EXISTS refund_requests_order_id_idx ON refund_requests(order_id)`,
        `CREATE INDEX IF NOT EXISTS user_notifications_user_created_idx ON user_notifications(user_id, created_at)`,
        `CREATE INDEX IF NOT EXISTS user_notifications_user_read_idx ON user_notifications(user_id, is_read, created_at)`,
        `CREATE INDEX IF NOT EXISTS admin_messages_created_idx ON admin_messages(created_at)`,
        `CREATE INDEX IF NOT EXISTS user_messages_read_created_idx ON user_messages(is_read, created_at)`,
        `CREATE INDEX IF NOT EXISTS user_messages_user_created_idx ON user_messages(user_id, created_at)`,
        `CREATE INDEX IF NOT EXISTS broadcast_messages_created_idx ON broadcast_messages(created_at)`,
        `CREATE UNIQUE INDEX IF NOT EXISTS broadcast_reads_message_user_uq ON broadcast_reads(message_id, user_id)`,
        `CREATE INDEX IF NOT EXISTS broadcast_reads_user_idx ON broadcast_reads(user_id, created_at)`,
        `CREATE INDEX IF NOT EXISTS wishlist_items_created_idx ON wishlist_items(created_at)`,
        `CREATE INDEX IF NOT EXISTS wishlist_votes_item_idx ON wishlist_votes(item_id, created_at)`,
        `CREATE UNIQUE INDEX IF NOT EXISTS wishlist_votes_item_user_uq ON wishlist_votes(item_id, user_id)`,
        `CREATE UNIQUE INDEX IF NOT EXISTS login_users_github_username_uq ON login_users(lower(username)) WHERE username IS NOT NULL AND lower(username) LIKE 'gh_%'`,
    ];

    // ... rest of ensureIndexes ...
    try {
        await db.run(sql`
            DELETE FROM broadcast_reads 
            WHERE id NOT IN (
                SELECT MIN(id) 
                FROM broadcast_reads 
                GROUP BY message_id, user_id
            )
        `);
    } catch {
    }

    for (const statement of indexStatements) {
        try {
            await db.run(sql.raw(statement));
        } catch (e: any) {
            const errorString = (JSON.stringify(e) + String(e) + (e?.message || '')).toLowerCase();
            if (errorString.includes('no such table') || errorString.includes('does not exist')) {
                continue;
            }
            if (errorString.includes('already exists') || errorString.includes('constraint failed')) {
                continue;
            }
            throw e;
        }
    }
}

// Auto-initialize database on first query
async function ensureDatabaseInitialized() {
    if (dbInitialized) return;

    try {
        // OPTIMIZATION: Check schema version first to avoid heavy DDL checks
        try {
            const version = await getSetting('schema_version');
            if (version === String(CURRENT_SCHEMA_VERSION)) {
                dbInitialized = true;
                return;
            }
        } catch (e) {
            // Settings table likely doesn't exist, proceed to full checks
        }

        // Quick check if products table exists
        await db.all(sql`SELECT 1 FROM products LIMIT 1`);

        // IMPORTANT: Even if table exists, ensure columns exist!
        await ensureProductsColumns();
        await ensureOrdersColumns();
        await ensureCardsColumns();
        await ensureCardKeyDuplicatesAllowed();
        await ensureLoginUsersTable();
        await ensureLoginUsersColumns(); // Add this call
        loginUsersSchemaReady = true;
        await ensureUserNotificationsTable();
        await ensureAdminMessagesTable();
        await ensureUserMessagesTable();
        await ensureBroadcastTables();
        await ensureWishlistTables();
        await migrateTimestampColumnsToMs();
        await migrateMalformedGitHubUserIds();
        await migrateGitHubUsersDedupAndCanonicalize();
        await ensureIndexes();
        await backfillProductAggregates();

        // Update schema version
        await setSetting('schema_version', String(CURRENT_SCHEMA_VERSION));

        dbInitialized = true;
        return;
    } catch {
        // Table doesn't exist, initialize database
    }
    // ...


    console.log("First run detected, initializing database...");

    dbExecRaw(`
        CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            price TEXT NOT NULL,
            compare_at_price TEXT,
            max_points_discount TEXT,
            category TEXT,
            image TEXT,
            is_hot INTEGER DEFAULT 0,
            is_active INTEGER DEFAULT 1,
            is_shared INTEGER DEFAULT 0,
            sort_order INTEGER DEFAULT 0,
            purchase_limit INTEGER,
            purchase_warning TEXT,
            visibility_level INTEGER DEFAULT -1,
            stock_count INTEGER DEFAULT 0,
            locked_count INTEGER DEFAULT 0,
            sold_count INTEGER DEFAULT 0,
            created_at INTEGER DEFAULT (unixepoch() * 1000)
        );
        CREATE TABLE IF NOT EXISTS cards (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            card_key TEXT NOT NULL,
            is_used INTEGER DEFAULT 0,
            reserved_order_id TEXT,
            reserved_at INTEGER,
            expires_at INTEGER,
            used_at INTEGER,
            created_at INTEGER DEFAULT (unixepoch() * 1000)
        );
        CREATE TABLE IF NOT EXISTS orders (
            order_id TEXT PRIMARY KEY,
            product_id TEXT NOT NULL,
            product_name TEXT NOT NULL,
            amount TEXT NOT NULL,
            email TEXT,
            payee TEXT,
            status TEXT DEFAULT 'pending',
            trade_no TEXT,
            card_key TEXT,
            card_ids TEXT,
            paid_at INTEGER,
            delivered_at INTEGER,
            user_id TEXT,
            username TEXT,
            points_used INTEGER DEFAULT 0,
            quantity INTEGER DEFAULT 1,
            current_payment_id TEXT,
            created_at INTEGER DEFAULT (unixepoch() * 1000)
        );
        CREATE TABLE IF NOT EXISTS login_users (
            user_id TEXT PRIMARY KEY,
            username TEXT,
            points INTEGER DEFAULT 0,
            is_blocked INTEGER DEFAULT 0,
            desktop_notifications_enabled INTEGER DEFAULT 0,
            created_at INTEGER DEFAULT (unixepoch() * 1000),
            last_login_at INTEGER DEFAULT (unixepoch() * 1000)
        );
        CREATE TABLE IF NOT EXISTS daily_checkins_v2 (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL REFERENCES login_users(user_id) ON DELETE CASCADE,
            created_at INTEGER DEFAULT (unixepoch() * 1000)
        );
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT,
            updated_at INTEGER DEFAULT (unixepoch() * 1000)
        );
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            icon TEXT,
            sort_order INTEGER DEFAULT 0,
            created_at INTEGER DEFAULT (unixepoch() * 1000),
            updated_at INTEGER DEFAULT (unixepoch() * 1000)
        );
        CREATE UNIQUE INDEX IF NOT EXISTS categories_name_uq ON categories(name);
        CREATE TABLE IF NOT EXISTS reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            order_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            username TEXT NOT NULL,
            rating INTEGER NOT NULL,
            comment TEXT,
            created_at INTEGER DEFAULT (unixepoch() * 1000)
        );
        CREATE TABLE IF NOT EXISTS refund_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id TEXT NOT NULL,
            user_id TEXT,
            username TEXT,
            reason TEXT,
            status TEXT DEFAULT 'pending',
            admin_username TEXT,
            admin_note TEXT,
            created_at INTEGER DEFAULT (unixepoch() * 1000),
            updated_at INTEGER DEFAULT (unixepoch() * 1000),
            processed_at INTEGER
        );
        CREATE TABLE IF NOT EXISTS user_notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL REFERENCES login_users(user_id) ON DELETE CASCADE,
            type TEXT NOT NULL,
            title_key TEXT NOT NULL,
            content_key TEXT NOT NULL,
            data TEXT,
            is_read INTEGER DEFAULT 0,
            created_at INTEGER DEFAULT (unixepoch() * 1000)
        );
        CREATE TABLE IF NOT EXISTS admin_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            target_type TEXT NOT NULL,
            target_value TEXT,
            title TEXT NOT NULL,
            body TEXT NOT NULL,
            sender TEXT,
            created_at INTEGER DEFAULT (unixepoch() * 1000)
        );
        CREATE TABLE IF NOT EXISTS user_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL REFERENCES login_users(user_id) ON DELETE CASCADE,
            username TEXT,
            title TEXT NOT NULL,
            body TEXT NOT NULL,
            is_read INTEGER DEFAULT 0,
            created_at INTEGER DEFAULT (unixepoch() * 1000)
        );
        CREATE TABLE IF NOT EXISTS broadcast_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            body TEXT NOT NULL,
            sender TEXT,
            created_at INTEGER DEFAULT (unixepoch() * 1000)
        );
        CREATE TABLE IF NOT EXISTS broadcast_reads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            message_id INTEGER NOT NULL REFERENCES broadcast_messages(id) ON DELETE CASCADE,
            user_id TEXT NOT NULL REFERENCES login_users(user_id) ON DELETE CASCADE,
            created_at INTEGER DEFAULT (unixepoch() * 1000)
        );
        CREATE TABLE IF NOT EXISTS wishlist_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            user_id TEXT,
            username TEXT,
            created_at INTEGER DEFAULT (unixepoch() * 1000)
        );
        CREATE TABLE IF NOT EXISTS wishlist_votes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_id INTEGER NOT NULL REFERENCES wishlist_items(id) ON DELETE CASCADE,
            user_id TEXT NOT NULL REFERENCES login_users(user_id) ON DELETE CASCADE,
            created_at INTEGER DEFAULT (unixepoch() * 1000)
        );
        CREATE UNIQUE INDEX IF NOT EXISTS wishlist_votes_item_user_uq ON wishlist_votes(item_id, user_id);
    `);

    await migrateTimestampColumnsToMs();
    await migrateMalformedGitHubUserIds();
    await migrateGitHubUsersDedupAndCanonicalize();
    await ensureIndexes();
    await backfillProductAggregates();

    // Set initial schema version
    try {
        await setSetting('schema_version', String(CURRENT_SCHEMA_VERSION));
    } catch {
        // If setSetting failed (e.g. settings table issue), try to ensure it exists and retry
        await ensureSettingsTable();
        await setSetting('schema_version', String(CURRENT_SCHEMA_VERSION));
    }

    dbInitialized = true;
    console.log("Database initialized successfully");
}

async function ensureProductsColumns() {
    await ensureColumnsOnce('products', async () => {
        await safeAddColumn('products', 'compare_at_price', 'TEXT');
        await safeAddColumn('products', 'max_points_discount', 'TEXT');
        await safeAddColumn('products', 'is_hot', 'INTEGER DEFAULT 0');
        await safeAddColumn('products', 'purchase_warning', 'TEXT');
        await safeAddColumn('products', 'is_shared', 'INTEGER DEFAULT 0');
        await safeAddColumn('products', 'visibility_level', 'INTEGER DEFAULT -1');
        await safeAddColumn('products', 'stock_count', 'INTEGER DEFAULT 0');
        await safeAddColumn('products', 'locked_count', 'INTEGER DEFAULT 0');
        await safeAddColumn('products', 'sold_count', 'INTEGER DEFAULT 0');
        await safeAddColumn('products', 'rating', 'REAL DEFAULT 0');
        await safeAddColumn('products', 'review_count', 'INTEGER DEFAULT 0');
    });
}

async function ensureOrdersColumns() {
    await ensureColumnsOnce('orders', async () => {
        await safeAddColumn('orders', 'points_used', 'INTEGER DEFAULT 0 NOT NULL');
        await safeAddColumn('orders', 'current_payment_id', 'TEXT');
        await safeAddColumn('orders', 'payee', 'TEXT');
        await safeAddColumn('orders', 'card_ids', 'TEXT');
    });
}

async function ensureCardsColumns() {
    await ensureColumnsOnce('cards', async () => {
        await safeAddColumn('cards', 'reserved_order_id', 'TEXT');
        await safeAddColumn('cards', 'reserved_at', 'INTEGER');
        await safeAddColumn('cards', 'expires_at', 'INTEGER');
    });
}

async function ensureLoginUsersColumns() {
    await ensureColumnsOnce('loginUsers', async () => {
        await safeAddColumn('login_users', 'last_checkin_at', 'INTEGER');
        await safeAddColumn('login_users', 'consecutive_days', 'INTEGER DEFAULT 0');
        await safeAddColumn('login_users', 'desktop_notifications_enabled', 'INTEGER DEFAULT 0');
    });
}

export async function ensureLoginUsersSchema() {
    if (loginUsersSchemaReady) return;
    await ensureLoginUsersTable();
    await ensureLoginUsersColumns();
    await safeAddColumn('login_users', 'email', 'TEXT');
    await safeAddColumn('login_users', 'points', 'INTEGER DEFAULT 0 NOT NULL');
    await safeAddColumn('login_users', 'is_blocked', 'INTEGER DEFAULT 0');
    await safeAddColumn('login_users', 'desktop_notifications_enabled', 'INTEGER DEFAULT 0');
    loginUsersSchemaReady = true;
}

async function isProductAggregatesBackfilled(): Promise<boolean> {
    try {
        const result = await db.select({ value: settings.value })
            .from(settings)
            .where(eq(settings.key, 'product_aggregates_backfilled_v2'));
        return result[0]?.value === '1';
    } catch (error: any) {
        if (isMissingTable(error)) {
            await ensureSettingsTable();
            return false;
        }
        throw error;
    }
}

async function markProductAggregatesBackfilled() {
    await db.insert(settings).values({
        key: 'product_aggregates_backfilled_v2',
        value: '1',
        updatedAt: new Date()
    }).onConflictDoUpdate({
        target: settings.key,
        set: { value: '1', updatedAt: new Date() }
    });
}

export async function recalcProductAggregates(productId: string) {
    const pid = (productId || '').trim();
    if (!pid) return;

    try {
        await ensureProductsColumns();
        await ensureCardsColumns();
    } catch (error: any) {
        if (isMissingTableOrColumn(error)) return;
        throw error;
    }

    const product = await db.query.products.findFirst({
        where: eq(products.id, pid),
        columns: { isShared: true }
    });
    if (!product) return;

    const nowMs = Date.now();
    const fiveMinutesAgo = nowMs - RESERVATION_TTL_MS;
    let unusedCount = 0;
    let availableCount = 0;
    let lockedCount = 0;

    try {
        const cardRows = await db.select({
            unused: sql<number>`COALESCE(SUM(CASE WHEN COALESCE(${cards.isUsed}, 0) = 0 AND (${cards.expiresAt} IS NULL OR ${cards.expiresAt} > ${nowMs}) THEN 1 ELSE 0 END), 0)`,
            available: sql<number>`COALESCE(SUM(CASE WHEN COALESCE(${cards.isUsed}, 0) = 0 AND (${cards.expiresAt} IS NULL OR ${cards.expiresAt} > ${nowMs}) AND (${cards.reservedAt} IS NULL OR ${cards.reservedAt} < ${fiveMinutesAgo}) THEN 1 ELSE 0 END), 0)`,
            locked: sql<number>`COALESCE(SUM(CASE WHEN COALESCE(${cards.isUsed}, 0) = 0 AND (${cards.expiresAt} IS NULL OR ${cards.expiresAt} > ${nowMs}) AND ${cards.reservedAt} IS NOT NULL AND ${cards.reservedAt} >= ${fiveMinutesAgo} THEN 1 ELSE 0 END), 0)`
        })
            .from(cards)
            .where(eq(cards.productId, pid));

        const row = cardRows[0];
        unusedCount = Number(row?.unused || 0);
        availableCount = Number(row?.available || 0);
        lockedCount = Number(row?.locked || 0);
    } catch (error: any) {
        if (!isMissingTableOrColumn(error)) throw error;
    }

    let soldCount = 0;
    try {
        const soldRows = await db.select({
            total: sql<number>`COALESCE(SUM(CASE WHEN ${orders.status} IN ('paid', 'delivered') THEN ${orders.quantity} ELSE 0 END), 0)`
        })
            .from(orders)
            .where(eq(orders.productId, pid));
        soldCount = Number(soldRows[0]?.total || 0);
    } catch (error: any) {
        if (!isMissingTableOrColumn(error)) throw error;
    }

    let rating = 0;
    let reviewCount = 0;
    try {
        const reviewRows = await db.select({
            avg: sql<number>`COALESCE(AVG(${reviews.rating}), 0)`,
            count: sql<number>`COUNT(*)`
        })
            .from(reviews)
            .where(eq(reviews.productId, pid));
        rating = Number(reviewRows[0]?.avg || 0);
        reviewCount = Number(reviewRows[0]?.count || 0);
    } catch (error: any) {
        if (!isMissingTableOrColumn(error)) throw error;
    }

    const stockCount = product.isShared ? (unusedCount > 0 ? INFINITE_STOCK : 0) : availableCount;

    await db.update(products)
        .set({
            stockCount,
            lockedCount,
            soldCount,
            rating,
            reviewCount
        })
        .where(eq(products.id, pid));
}

export async function recalcProductAggregatesForMany(productIds: string[]) {
    const ids = Array.from(new Set((productIds || []).map((id) => String(id).trim()).filter(Boolean)));
    if (!ids.length) return;

    try {
        await ensureProductsColumns();
        await ensureCardsColumns();
    } catch (error: any) {
        if (isMissingTableOrColumn(error)) return;
        throw error;
    }

    const QUERY_BATCH_SIZE = 50;
    const UPDATE_BATCH_SIZE = 8;
    const nowMs = Date.now();
    const fiveMinutesAgo = nowMs - RESERVATION_TTL_MS;

    const aggregates = new Map<string, {
        isShared: boolean;
        unused: number;
        available: number;
        locked: number;
        sold: number;
        rating: number;
        reviewCount: number;
    }>();

    for (let i = 0; i < ids.length; i += QUERY_BATCH_SIZE) {
        const batch = ids.slice(i, i + QUERY_BATCH_SIZE);
        const rows = await db.select({ id: products.id, isShared: products.isShared })
            .from(products)
            .where(inArray(products.id, batch));
        for (const row of rows) {
            aggregates.set(row.id, {
                isShared: !!row.isShared,
                unused: 0,
                available: 0,
                locked: 0,
                sold: 0,
                rating: 0,
                reviewCount: 0
            });
        }
    }

    const existingIds = Array.from(aggregates.keys());
    if (!existingIds.length) return;

    try {
        for (let i = 0; i < existingIds.length; i += QUERY_BATCH_SIZE) {
            const batch = existingIds.slice(i, i + QUERY_BATCH_SIZE);
            const cardRows = await db.select({
                productId: cards.productId,
                unused: sql<number>`COALESCE(SUM(CASE WHEN COALESCE(${cards.isUsed}, 0) = 0 AND (${cards.expiresAt} IS NULL OR ${cards.expiresAt} > ${nowMs}) THEN 1 ELSE 0 END), 0)`,
                available: sql<number>`COALESCE(SUM(CASE WHEN COALESCE(${cards.isUsed}, 0) = 0 AND (${cards.expiresAt} IS NULL OR ${cards.expiresAt} > ${nowMs}) AND (${cards.reservedAt} IS NULL OR ${cards.reservedAt} < ${fiveMinutesAgo}) THEN 1 ELSE 0 END), 0)`,
                locked: sql<number>`COALESCE(SUM(CASE WHEN COALESCE(${cards.isUsed}, 0) = 0 AND (${cards.expiresAt} IS NULL OR ${cards.expiresAt} > ${nowMs}) AND ${cards.reservedAt} IS NOT NULL AND ${cards.reservedAt} >= ${fiveMinutesAgo} THEN 1 ELSE 0 END), 0)`
            })
                .from(cards)
                .where(inArray(cards.productId, batch))
                .groupBy(cards.productId);

            for (const row of cardRows) {
                const agg = aggregates.get(row.productId);
                if (!agg) continue;
                agg.unused = Number(row.unused || 0);
                agg.available = Number(row.available || 0);
                agg.locked = Number(row.locked || 0);
            }
        }
    } catch (error: any) {
        if (!isMissingTableOrColumn(error)) throw error;
    }

    try {
        for (let i = 0; i < existingIds.length; i += QUERY_BATCH_SIZE) {
            const batch = existingIds.slice(i, i + QUERY_BATCH_SIZE);
            const soldRows = await db.select({
                productId: orders.productId,
                total: sql<number>`COALESCE(SUM(CASE WHEN ${orders.status} IN ('paid', 'delivered') THEN ${orders.quantity} ELSE 0 END), 0)`
            })
                .from(orders)
                .where(inArray(orders.productId, batch))
                .groupBy(orders.productId);

            for (const row of soldRows) {
                const agg = aggregates.get(row.productId);
                if (!agg) continue;
                agg.sold = Number(row.total || 0);
            }
        }
    } catch (error: any) {
        if (!isMissingTableOrColumn(error)) throw error;
    }

    try {
        for (let i = 0; i < existingIds.length; i += QUERY_BATCH_SIZE) {
            const batch = existingIds.slice(i, i + QUERY_BATCH_SIZE);
            const reviewRows = await db.select({
                productId: reviews.productId,
                avg: sql<number>`COALESCE(AVG(${reviews.rating}), 0)`,
                count: sql<number>`COUNT(*)`
            })
                .from(reviews)
                .where(inArray(reviews.productId, batch))
                .groupBy(reviews.productId);

            for (const row of reviewRows) {
                const agg = aggregates.get(row.productId);
                if (!agg) continue;
                agg.rating = Number(row.avg || 0);
                agg.reviewCount = Number(row.count || 0);
            }
        }
    } catch (error: any) {
        if (!isMissingTableOrColumn(error)) throw error;
    }

    const updates = existingIds.map((id) => {
        const agg = aggregates.get(id)!;
        const stockCount = agg.isShared ? (agg.unused > 0 ? INFINITE_STOCK : 0) : agg.available;
        return {
            id,
            stockCount,
            lockedCount: agg.locked,
            soldCount: agg.sold,
            rating: agg.rating,
            reviewCount: agg.reviewCount
        };
    });

    for (let i = 0; i < updates.length; i += UPDATE_BATCH_SIZE) {
        const batch = updates.slice(i, i + UPDATE_BATCH_SIZE);
        const idsBatch = batch.map((row) => row.id);
        const stockCases = sql.join(
            batch.map((row) => sql`WHEN ${products.id} = ${row.id} THEN ${row.stockCount}`),
            sql` `
        );
        const lockedCases = sql.join(
            batch.map((row) => sql`WHEN ${products.id} = ${row.id} THEN ${row.lockedCount}`),
            sql` `
        );
        const soldCases = sql.join(
            batch.map((row) => sql`WHEN ${products.id} = ${row.id} THEN ${row.soldCount}`),
            sql` `
        );
        const ratingCases = sql.join(
            batch.map((row) => sql`WHEN ${products.id} = ${row.id} THEN ${row.rating}`),
            sql` `
        );
        const reviewCases = sql.join(
            batch.map((row) => sql`WHEN ${products.id} = ${row.id} THEN ${row.reviewCount}`),
            sql` `
        );

        await db.run(sql`
            UPDATE products
            SET
                stock_count = CASE ${products.id} ${stockCases} ELSE ${products.stockCount} END,
                locked_count = CASE ${products.id} ${lockedCases} ELSE ${products.lockedCount} END,
                sold_count = CASE ${products.id} ${soldCases} ELSE ${products.soldCount} END,
                rating = CASE ${products.id} ${ratingCases} ELSE ${products.rating} END,
                review_count = CASE ${products.id} ${reviewCases} ELSE ${products.reviewCount} END
            WHERE ${inArray(products.id, idsBatch)}
        `);
    }
}

export async function getLiveCardStats(productIds: string[]): Promise<Map<string, { unused: number; available: number; locked: number }>> {
    const ids = Array.from(new Set((productIds || []).map((id) => String(id).trim()).filter(Boolean)));
    const stats = new Map<string, { unused: number; available: number; locked: number }>();
    if (!ids.length) return stats;

    for (const id of ids) {
        stats.set(id, { unused: 0, available: 0, locked: 0 });
    }

    try {
        await ensureCardsColumns();
    } catch (error: any) {
        if (isMissingTableOrColumn(error)) return stats;
        throw error;
    }

    const nowMs = Date.now();
    const fiveMinutesAgo = nowMs - RESERVATION_TTL_MS;

    try {
        const rows = await db.select({
            productId: cards.productId,
            unused: sql<number>`COALESCE(SUM(CASE WHEN COALESCE(${cards.isUsed}, 0) = 0 AND (${cards.expiresAt} IS NULL OR ${cards.expiresAt} > ${nowMs}) THEN 1 ELSE 0 END), 0)`,
            available: sql<number>`COALESCE(SUM(CASE WHEN COALESCE(${cards.isUsed}, 0) = 0 AND (${cards.expiresAt} IS NULL OR ${cards.expiresAt} > ${nowMs}) AND (${cards.reservedAt} IS NULL OR ${cards.reservedAt} < ${fiveMinutesAgo}) THEN 1 ELSE 0 END), 0)`,
            locked: sql<number>`COALESCE(SUM(CASE WHEN COALESCE(${cards.isUsed}, 0) = 0 AND (${cards.expiresAt} IS NULL OR ${cards.expiresAt} > ${nowMs}) AND ${cards.reservedAt} IS NOT NULL AND ${cards.reservedAt} >= ${fiveMinutesAgo} THEN 1 ELSE 0 END), 0)`
        })
            .from(cards)
            .where(inArray(cards.productId, ids))
            .groupBy(cards.productId);

        for (const row of rows) {
            if (!row.productId) continue;
            stats.set(row.productId, {
                unused: Number(row.unused || 0),
                available: Number(row.available || 0),
                locked: Number(row.locked || 0),
            });
        }
    } catch (error: any) {
        if (!isMissingTableOrColumn(error)) throw error;
    }

    return stats;
}

async function backfillProductAggregates() {
    const already = await isProductAggregatesBackfilled();
    if (already) return;

    try {
        await ensureProductsColumns();
        const rows = await db.select({ id: products.id }).from(products);
        await recalcProductAggregatesForMany(rows.map((row) => row.id));
        await markProductAggregatesBackfilled();
    } catch (error: any) {
        if (!isMissingTableOrColumn(error)) throw error;
    }
}

async function withProductColumnFallback<T>(fn: () => Promise<T>): Promise<T> {
    try {
        return await fn()
    } catch (error: any) {
        // Use more robust string conversion for error checking
        const errorString = (JSON.stringify(error) + String(error) + (error?.message || '')).toLowerCase();

        // Check for missing column errors (PostgreSQL: 42703, SQLite/D1: no such column, D1_COLUMN_NOTFOUND)
        if (errorString.includes('42703') || errorString.includes('no such column') || errorString.includes('column not found') || errorString.includes('d1_column_notfound')) {
            console.log("Detected missing column error, attempting remediation...");
            await ensureProductsColumns();
            return await fn();
        }
        throw error;
    }
}

export async function withOrderColumnFallback<T>(fn: () => Promise<T>): Promise<T> {
    await ensureDatabaseInitialized()
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
            maxPointsDiscount: products.maxPointsDiscount,
            image: products.image,
            category: products.category,
            isHot: products.isHot,
            isActive: products.isActive,
            isShared: products.isShared,
            visibilityLevel: products.visibilityLevel,
            sortOrder: products.sortOrder,
            purchaseLimit: products.purchaseLimit,
            stock: sql<number>`COALESCE(${products.stockCount}, 0)`,
            locked: sql<number>`COALESCE(${products.lockedCount}, 0)`,
            sold: sql<number>`COALESCE(${products.soldCount}, 0)`
        })
            .from(products)
            .orderBy(asc(products.sortOrder), desc(products.createdAt));
    })
}

function resolveVisibilityThreshold(isLoggedIn?: boolean, trustLevel?: number | null) {
    if (!isLoggedIn) return -1;
    const level = Number.isFinite(Number(trustLevel)) ? Number(trustLevel) : 0;
    return Math.max(0, level);
}

function visibilityCondition(isLoggedIn?: boolean, trustLevel?: number | null) {
    const threshold = resolveVisibilityThreshold(isLoggedIn, trustLevel);
    return lte(sql<number>`COALESCE(${products.visibilityLevel}, -1)`, threshold);
}

// Get only active products (for home page)
export async function getActiveProducts(options?: { isLoggedIn?: boolean; trustLevel?: number | null }) {
    // Auto-initialize database on first access
    await ensureDatabaseInitialized();

    return await withProductColumnFallback(async () => {
        return await db.select({
            id: products.id,
            name: products.name,
            description: products.description,
            price: products.price,
            compareAtPrice: products.compareAtPrice,
            maxPointsDiscount: products.maxPointsDiscount,
            image: products.image,
            category: products.category,
            isHot: products.isHot,
            isShared: products.isShared,
            purchaseLimit: products.purchaseLimit,
            visibilityLevel: products.visibilityLevel,
            stock: sql<number>`COALESCE(${products.stockCount}, 0)`,
            locked: sql<number>`COALESCE(${products.lockedCount}, 0)`,
            sold: sql<number>`COALESCE(${products.soldCount}, 0)`,
            rating: sql<number>`COALESCE(${products.rating}, 0)`,
            reviewCount: sql<number>`COALESCE(${products.reviewCount}, 0)`
        })
            .from(products)
            .where(and(eq(products.isActive, true), visibilityCondition(options?.isLoggedIn, options?.trustLevel)))
            .orderBy(asc(products.sortOrder), desc(products.createdAt));
    })
}

export async function getWishlistItems(userId: string | null, limit = 10) {
    await ensureDatabaseInitialized();

    try {
        const rows: any[] = await db.all(sql`
            SELECT
                wi.id AS id,
                wi.title AS title,
                wi.description AS description,
                wi.username AS username,
                wi.created_at AS created_at,
                COUNT(wv.id) AS votes,
                SUM(CASE WHEN wv.user_id = ${userId} THEN 1 ELSE 0 END) AS voted
            FROM wishlist_items wi
            LEFT JOIN wishlist_votes wv ON wv.item_id = wi.id
            GROUP BY wi.id
            ORDER BY votes DESC, wi.created_at DESC
            LIMIT ${limit}
        `);

        return rows.map((row: any) => ({
            id: Number(row.id),
            title: row.title,
            description: row.description,
            username: row.username,
            createdAt: Number(row.created_at ?? row.createdAt ?? 0),
            votes: Number(row.votes || 0),
            voted: Number(row.voted || 0) > 0,
        }));
    } catch (error: any) {
        if (isMissingTableOrColumn(error)) {
            await ensureWishlistTables();
            // Retry once
            try {
                const rows: any[] = await db.all(sql`
                    SELECT
                        wi.id AS id,
                        wi.title AS title,
                        wi.description AS description,
                        wi.username AS username,
                        wi.created_at AS created_at,
                        COUNT(wv.id) AS votes,
                        SUM(CASE WHEN wv.user_id = ${userId} THEN 1 ELSE 0 END) AS voted
                    FROM wishlist_items wi
                    LEFT JOIN wishlist_votes wv ON wv.item_id = wi.id
                    GROUP BY wi.id
                    ORDER BY votes DESC, wi.created_at DESC
                    LIMIT ${limit}
                `);
                return rows.map((row: any) => ({
                    id: Number(row.id),
                    title: row.title,
                    description: row.description,
                    username: row.username,
                    createdAt: Number(row.created_at ?? row.createdAt ?? 0),
                    votes: Number(row.votes || 0),
                    voted: Number(row.voted || 0) > 0,
                }));
            } catch (retryError) {
                console.error('getWishlistItems retry failed:', retryError);
                return [];
            }
        }
        console.error('getWishlistItems failed:', error);
        return [];
    }
}

export async function getProduct(id: string, options?: { isLoggedIn?: boolean; trustLevel?: number | null }) {
    return await withProductColumnFallback(async () => {
        const result = await db.select({
            id: products.id,
            name: products.name,
            description: products.description,
            price: products.price,
            compareAtPrice: products.compareAtPrice,
            maxPointsDiscount: products.maxPointsDiscount,
            image: products.image,
            category: products.category,
            isHot: products.isHot,
            isActive: products.isActive,
            isShared: products.isShared,
            purchaseLimit: products.purchaseLimit,
            purchaseWarning: products.purchaseWarning,
            visibilityLevel: products.visibilityLevel,
            stock: sql<number>`COALESCE(${products.stockCount}, 0)`,
            locked: sql<number>`COALESCE(${products.lockedCount}, 0)`,
            rating: sql<number>`COALESCE(${products.rating}, 0)`,
            reviewCount: sql<number>`COALESCE(${products.reviewCount}, 0)`
        })
            .from(products)
            .where(and(eq(products.id, id), visibilityCondition(options?.isLoggedIn, options?.trustLevel)))
            ;

        // Return null if product doesn't exist or is inactive
        const product = result[0];
        if (!product || product.isActive === false) {
            return null;
        }
        return product;
    })
}

export async function getProductVisibility(id: string) {
    return await withProductColumnFallback(async () => {
        const result = await db.select({
            id: products.id,
            isActive: products.isActive,
            visibilityLevel: products.visibilityLevel,
        })
            .from(products)
            .where(eq(products.id, id));

        return result[0] || null;
    });
}

// Get product for admin (includes inactive products)
export async function getProductForAdmin(id: string) {
    return await withProductColumnFallback(async () => {
        const result = await db.select({
            id: products.id,
            name: products.name,
            description: products.description,
            price: products.price,
            compareAtPrice: products.compareAtPrice,
            maxPointsDiscount: products.maxPointsDiscount,
            image: products.image,
            category: products.category,
            isHot: products.isHot,
            isActive: products.isActive,
            isShared: products.isShared,
            purchaseLimit: products.purchaseLimit,
            purchaseWarning: products.purchaseWarning,
            visibilityLevel: products.visibilityLevel,
        })
            .from(products)
            .where(eq(products.id, id));

        return result[0] || null;
    });
}

// Dashboard Stats
export async function getDashboardStats(nowMs: number) {
    return await withOrderColumnFallback(async () => {
        const now = new Date(nowMs);
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekStart = new Date(todayStart);
        weekStart.setDate(weekStart.getDate() - 7);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const todayStartMs = todayStart.getTime();
        const weekStartMs = weekStart.getTime();
        const monthStartMs = monthStart.getTime();
        const stats = await db.select({
            totalCount: sql<number>`count(*)`,
            totalRevenue: sql<number>`COALESCE(sum(CAST(${orders.amount} AS REAL)), 0)`,
            todayCount: sql<number>`COALESCE(sum(CASE WHEN ${orders.paidAt} >= ${todayStartMs} THEN 1 ELSE 0 END), 0)`,
            todayRevenue: sql<number>`COALESCE(sum(CASE WHEN ${orders.paidAt} >= ${todayStartMs} THEN CAST(${orders.amount} AS REAL) ELSE 0 END), 0)`,
            weekCount: sql<number>`COALESCE(sum(CASE WHEN ${orders.paidAt} >= ${weekStartMs} THEN 1 ELSE 0 END), 0)`,
            weekRevenue: sql<number>`COALESCE(sum(CASE WHEN ${orders.paidAt} >= ${weekStartMs} THEN CAST(${orders.amount} AS REAL) ELSE 0 END), 0)`,
            monthCount: sql<number>`COALESCE(sum(CASE WHEN ${orders.paidAt} >= ${monthStartMs} THEN 1 ELSE 0 END), 0)`,
            monthRevenue: sql<number>`COALESCE(sum(CASE WHEN ${orders.paidAt} >= ${monthStartMs} THEN CAST(${orders.amount} AS REAL) ELSE 0 END), 0)`,
        })
            .from(orders)
            .where(eq(orders.status, 'delivered'));

        const row = stats[0] || {
            totalCount: 0,
            totalRevenue: 0,
            todayCount: 0,
            todayRevenue: 0,
            weekCount: 0,
            weekRevenue: 0,
            monthCount: 0,
            monthRevenue: 0,
        };

        return {
            today: { count: row.todayCount || 0, revenue: row.todayRevenue || 0 },
            week: { count: row.weekCount || 0, revenue: row.weekRevenue || 0 },
            month: { count: row.monthCount || 0, revenue: row.monthRevenue || 0 },
            total: { count: row.totalCount || 0, revenue: row.totalRevenue || 0 }
        };
    })
}

export async function getRecentOrders(limit: number = 10) {
    return await withOrderColumnFallback(async () => {
        return await db.query.orders.findMany({
            orderBy: [desc(normalizeTimestampMs(orders.createdAt))],
            limit
        })
    })
}

// Settings
export const getSetting = cache(async (key: string): Promise<string | null> => {
    const result = await db.select({ value: settings.value })
        .from(settings)
        .where(eq(settings.key, key));
    return result[0]?.value ?? null;
});

export const getAllSettings = cache(async (): Promise<Record<string, string>> => {
    try {
        const rows = await db.select({ key: settings.key, value: settings.value }).from(settings);
        return rows.reduce((acc, row) => {
            acc[row.key] = row.value || '';
            return acc;
        }, {} as Record<string, string>);
    } catch (error: any) {
        if (isMissingTable(error)) {
            await ensureSettingsTable();
            return {};
        }
        throw error;
    }
});

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
    dbExecRaw(`
        CREATE TABLE IF NOT EXISTS categories(
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

export async function getCategories(): Promise<Array<{ id: number; name: string; icon: string | null; sortOrder: number }>> {
    try {
        const rows = await db.select({
            id: categories.id,
            name: categories.name,
            icon: categories.icon,
            sortOrder: sql<number>`COALESCE(${categories.sortOrder}, 0)`,
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

export async function createUserNotification(params: {
    userId: string | null | undefined
    type: string
    titleKey: string
    contentKey: string
    data?: Record<string, any> | null
}) {
    if (!params.userId) return
    await ensureDatabaseInitialized()
    try {
        await db.insert(userNotifications).values({
            userId: params.userId,
            type: params.type,
            titleKey: params.titleKey,
            contentKey: params.contentKey,
            data: params.data ? JSON.stringify(params.data) : null,
            isRead: false,
            createdAt: new Date()
        })
    } catch (error: any) {
        if (isMissingTable(error)) {
            await ensureUserNotificationsTable()
            await db.insert(userNotifications).values({
                userId: params.userId,
                type: params.type,
                titleKey: params.titleKey,
                contentKey: params.contentKey,
                data: params.data ? JSON.stringify(params.data) : null,
                isRead: false,
                createdAt: new Date()
            })
            return
        }
        throw error
    }
}

export async function getUserNotifications(userId: string, limit: number = 20) {
    await ensureDatabaseInitialized()
    try {
        return await db.select({
            id: userNotifications.id,
            userId: userNotifications.userId,
            type: userNotifications.type,
            titleKey: userNotifications.titleKey,
            contentKey: userNotifications.contentKey,
            data: userNotifications.data,
            isRead: userNotifications.isRead,
            createdAt: userNotifications.createdAt
        })
            .from(userNotifications)
            .where(eq(userNotifications.userId, userId))
            .orderBy(desc(normalizeTimestampMs(userNotifications.createdAt)))
            .limit(limit)
    } catch (error: any) {
        if (isMissingTable(error)) {
            await ensureUserNotificationsTable()
            return []
        }
        throw error
    }
}

export async function markAllUserNotificationsRead(userId: string) {
    await ensureDatabaseInitialized()
    try {
        await db.update(userNotifications)
            .set({ isRead: true })
            .where(eq(userNotifications.userId, userId))
    } catch (error: any) {
        if (isMissingTable(error)) {
            await ensureUserNotificationsTable()
            return
        }
        throw error
    }
}

export async function getUserUnreadNotificationCount(userId: string) {
    await ensureDatabaseInitialized()
    try {
        const rows = await db.select({
            count: sql<number>`count(*)`
        })
            .from(userNotifications)
            .where(and(eq(userNotifications.userId, userId), eq(userNotifications.isRead, false)))
        return Number(rows[0]?.count || 0)
    } catch (error: any) {
        if (isMissingTable(error)) {
            await ensureUserNotificationsTable()
            return 0
        }
        throw error
    }
}

export async function markUserNotificationRead(userId: string, id: number) {
    await ensureDatabaseInitialized()
    try {
        await db.update(userNotifications)
            .set({ isRead: true })
            .where(and(eq(userNotifications.userId, userId), eq(userNotifications.id, id)))
    } catch (error: any) {
        if (isMissingTable(error)) {
            await ensureUserNotificationsTable()
            return
        }
        throw error
    }
}

export async function clearUserNotifications(userId: string) {
    await ensureDatabaseInitialized()
    try {
        await db.delete(userNotifications)
            .where(eq(userNotifications.userId, userId))
    } catch (error: any) {
        if (isMissingTable(error)) {
            await ensureUserNotificationsTable()
            return
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
    isLoggedIn?: boolean
    trustLevel?: number | null
}) {
    const q = (params.q || '').trim()
    const category = (params.category || '').trim()
    const sort = (params.sort || 'default').trim()
    const page = params.page && params.page > 0 ? params.page : 1
    const pageSize = Math.min(params.pageSize && params.pageSize > 0 ? params.pageSize : 24, 60)
    const offset = (page - 1) * pageSize

    const whereParts: any[] = [eq(products.isActive, true), visibilityCondition(params.isLoggedIn, params.trustLevel)]
    if (category && category !== 'all') whereParts.push(eq(products.category, category))
    if (q) {
        const like = `%${q}%`
        whereParts.push(or(
            sql`${products.name} LIKE ${like}`,
            sql`COALESCE(${products.description}, '') LIKE ${like}`
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
            orderByParts.push(desc(sql<number>`COALESCE(${products.stockCount}, 0) + COALESCE(${products.lockedCount}, 0)`))
            break
        case 'soldDesc':
            orderByParts.push(desc(sql<number>`COALESCE(${products.soldCount}, 0)`))
            break
        case 'hot':
            orderByParts.push(desc(sql<number>`case when ${products.isHot} = 1 then 1 else 0 end`))
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
            maxPointsDiscount: products.maxPointsDiscount,
            image: products.image,
            category: products.category,
            isHot: products.isHot,
            isShared: products.isShared,
            purchaseLimit: products.purchaseLimit,
            stock: sql<number>`COALESCE(${products.stockCount}, 0)`,
            locked: sql<number>`COALESCE(${products.lockedCount}, 0)`,
            sold: sql<number>`COALESCE(${products.soldCount}, 0)`,
            rating: sql<number>`COALESCE(${products.rating}, 0)`,
            reviewCount: sql<number>`COALESCE(${products.reviewCount}, 0)`
        })
            .from(products)
            .where(whereExpr)
            .orderBy(...orderByParts)
            .limit(pageSize)
            .offset(offset)

        const countQuery = db.select({ count: sql<number>`count(*)` }).from(products).where(whereExpr)
        return Promise.all([rowsPromise, countQuery])
    })

    return {
        items,
        total: totalRes[0]?.count || 0,
        page,
        pageSize,
    }
}

export async function getActiveProductCategories(options?: { isLoggedIn?: boolean; trustLevel?: number | null }): Promise<string[]> {
    await ensureDatabaseInitialized();
    try {
        const rows = await db
            .select({ category: products.category })
            .from(products)
            .where(and(
                eq(products.isActive, true),
                visibilityCondition(options?.isLoggedIn, options?.trustLevel),
                sql`${products.category} IS NOT NULL`,
                sql`TRIM(${products.category}) <> ''`
            ))
            .groupBy(products.category)
            .orderBy(asc(products.category));
        return rows.map((r) => r.category as string).filter(Boolean);
    } catch (error: any) {
        if (isMissingTable(error)) return [];
        throw error;
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
        avg: sql<number>`COALESCE(AVG(${reviews.rating}), 0)`,
        count: sql<number>`COUNT(*)`
    })
        .from(reviews)
        .where(eq(reviews.productId, productId));

    return {
        average: result[0]?.avg ?? 0,
        count: result[0]?.count ?? 0
    };
}

export async function getProductRatings(productIds: string[]): Promise<Map<string, { average: number; count: number }>> {
    const map = new Map<string, { average: number; count: number }>();
    if (!productIds.length) return map;

    try {
        const rows = await db.select({
            productId: reviews.productId,
            avg: sql<number>`COALESCE(AVG(${reviews.rating}), 0)`,
            count: sql<number>`COUNT(*)`
        })
            .from(reviews)
            .where(inArray(reviews.productId, productIds))
            .groupBy(reviews.productId);

        for (const row of rows) {
            map.set(row.productId, {
                average: row.avg ?? 0,
                count: row.count ?? 0
            });
        }
    } catch (error: any) {
        if (!isMissingTable(error)) throw error;
    }

    return map;
}

export async function createReview(data: {
    productId: string;
    orderId: string;
    userId: string;
    username: string;
    rating: number;
    comment?: string;
}) {
    const res = await db.insert(reviews).values({
        ...data,
        createdAt: new Date()
    }).returning();

    // Update product aggregates (rating/review_count)
    await recalcProductAggregates(data.productId);

    return res;
}

export async function canUserReview(userId: string, productId: string, username?: string): Promise<{ canReview: boolean; orderId?: string }> {
    try {
        const findUnreviewedOrder = async (whereClause: any) => {
            const rows = await db.select({ orderId: orders.orderId })
                .from(orders)
                .leftJoin(reviews, eq(reviews.orderId, orders.orderId))
                .where(and(
                    whereClause,
                    eq(orders.productId, productId),
                    eq(orders.status, 'delivered'),
                    isNull(reviews.id)
                ))
                .orderBy(desc(normalizeTimestampMs(orders.createdAt)))
                .limit(1);
            return rows[0]?.orderId;
        };

        // Prefer userId; only fallback to username when userId has no delivered orders.
        const byUserIdOrderId = await findUnreviewedOrder(eq(orders.userId, userId));
        if (byUserIdOrderId) {
            return { canReview: true, orderId: byUserIdOrderId };
        }

        const hasDeliveredByUserId = await db.select({ orderId: orders.orderId })
            .from(orders)
            .where(and(
                eq(orders.userId, userId),
                eq(orders.productId, productId),
                eq(orders.status, 'delivered')
            ))
            .limit(1);
        if (hasDeliveredByUserId.length > 0) {
            return { canReview: false };
        }

        if (!username) {
            return { canReview: false };
        }

        const byUsernameOrderId = await findUnreviewedOrder(eq(orders.username, username));
        if (byUsernameOrderId) {
            return { canReview: true, orderId: byUsernameOrderId };
        }

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
    const msg = (error?.message || '') + (error?.cause?.message || '');
    const errorString = JSON.stringify(error);
    return (
        msg.includes('does not exist') ||
        msg.includes('no such table') ||
        errorString.includes('42P01') ||
        errorString.includes('no such table') ||
        (errorString.includes('relation') && errorString.includes('does not exist'))
    );
}

function isMissingTableOrColumn(error: any) {
    const errorString = (JSON.stringify(error) + String(error) + (error?.message || '')).toLowerCase();
    return isMissingTable(error) || errorString.includes('42703') || errorString.includes('no such column') || errorString.includes('column not found') || errorString.includes('d1_column_notfound');
}

const TIMESTAMP_MS_THRESHOLD = 1_000_000_000_000;

export function normalizeTimestampMs(column: any) {
    return sql<number>`CASE WHEN ${column} < ${TIMESTAMP_MS_THRESHOLD} THEN ${column} * 1000 ELSE ${column} END`
}

async function migrateTimestampColumnsToMs() {
    const tableColumns = [
        { table: 'products', columns: ['created_at'] },
        { table: 'cards', columns: ['reserved_at', 'used_at', 'created_at'] },
        { table: 'orders', columns: ['paid_at', 'delivered_at', 'created_at'] },
        { table: 'login_users', columns: ['created_at', 'last_login_at'] },
        { table: 'daily_checkins_v2', columns: ['created_at'] },
        { table: 'settings', columns: ['updated_at'] },
        { table: 'reviews', columns: ['created_at'] },
        { table: 'categories', columns: ['created_at', 'updated_at'] },
        { table: 'refund_requests', columns: ['created_at', 'updated_at', 'processed_at'] },
        { table: 'user_notifications', columns: ['created_at'] },
        { table: 'admin_messages', columns: ['created_at'] },
        { table: 'user_messages', columns: ['created_at'] },
        { table: 'broadcast_messages', columns: ['created_at'] },
        { table: 'broadcast_reads', columns: ['created_at'] },
        { table: 'wishlist_items', columns: ['created_at'] },
        { table: 'wishlist_votes', columns: ['created_at'] },
    ];

    for (const { table, columns } of tableColumns) {
        for (const column of columns) {
            try {
                await db.run(sql.raw(
                    `UPDATE ${table} SET ${column} = ${column} * 1000 WHERE ${column} IS NOT NULL AND ${column} < ${TIMESTAMP_MS_THRESHOLD}`
                ));
            } catch (error: any) {
                if (!isMissingTableOrColumn(error)) throw error;
            }
        }
    }
}

async function ensureLoginUsersTable() {
    await db.run(sql`
        CREATE TABLE IF NOT EXISTS login_users(
        user_id TEXT PRIMARY KEY,
        username TEXT,
        email TEXT,
        points INTEGER DEFAULT 0 NOT NULL,
        is_blocked BOOLEAN DEFAULT FALSE,
        desktop_notifications_enabled INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (unixepoch() * 1000),
        last_login_at INTEGER DEFAULT (unixepoch() * 1000)
    )
        `);
}

async function ensureSettingsTable() {
    await db.run(sql`
        CREATE TABLE IF NOT EXISTS settings(
            key TEXT PRIMARY KEY,
            value TEXT,
            updated_at INTEGER DEFAULT (unixepoch() * 1000)
        )
        `);
}

async function ensureUserNotificationsTable() {
    await db.run(sql`
        CREATE TABLE IF NOT EXISTS user_notifications(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL REFERENCES login_users(user_id) ON DELETE CASCADE,
            type TEXT NOT NULL,
            title_key TEXT NOT NULL,
            content_key TEXT NOT NULL,
            data TEXT,
            is_read INTEGER DEFAULT 0,
            created_at INTEGER DEFAULT (unixepoch() * 1000)
        )
    `);
}

async function ensureAdminMessagesTable() {
    await db.run(sql`
        CREATE TABLE IF NOT EXISTS admin_messages(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            target_type TEXT NOT NULL,
            target_value TEXT,
            title TEXT NOT NULL,
            body TEXT NOT NULL,
            sender TEXT,
            created_at INTEGER DEFAULT (unixepoch() * 1000)
        )
    `);
}

async function ensureUserMessagesTable() {
    await db.run(sql`
        CREATE TABLE IF NOT EXISTS user_messages(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL REFERENCES login_users(user_id) ON DELETE CASCADE,
            username TEXT,
            title TEXT NOT NULL,
            body TEXT NOT NULL,
            is_read INTEGER DEFAULT 0,
            created_at INTEGER DEFAULT (unixepoch() * 1000)
        )
    `);
}

async function ensureBroadcastTables() {
    dbExecRaw(`
        CREATE TABLE IF NOT EXISTS broadcast_messages(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            body TEXT NOT NULL,
            sender TEXT,
            created_at INTEGER DEFAULT (unixepoch() * 1000)
        );
        CREATE TABLE IF NOT EXISTS broadcast_reads(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            message_id INTEGER NOT NULL REFERENCES broadcast_messages(id) ON DELETE CASCADE,
            user_id TEXT NOT NULL REFERENCES login_users(user_id) ON DELETE CASCADE,
            created_at INTEGER DEFAULT (unixepoch() * 1000)
        );
    `);

    await ensureCardKeyDuplicatesAllowed();
}

async function ensureWishlistTables() {
    if (wishlistTablesReady) return;
    dbExecRaw(`
        CREATE TABLE IF NOT EXISTS wishlist_items(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            user_id TEXT,
            username TEXT,
            created_at INTEGER DEFAULT (unixepoch() * 1000)
        );
        CREATE TABLE IF NOT EXISTS wishlist_votes(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_id INTEGER NOT NULL REFERENCES wishlist_items(id) ON DELETE CASCADE,
            user_id TEXT NOT NULL REFERENCES login_users(user_id) ON DELETE CASCADE,
            created_at INTEGER DEFAULT (unixepoch() * 1000)
        );
        CREATE UNIQUE INDEX IF NOT EXISTS wishlist_votes_item_user_uq ON wishlist_votes(item_id, user_id);
    `);

    await ensureWishlistColumns();
    wishlistTablesReady = true;
}

async function ensureWishlistColumns() {
    await safeAddColumn('wishlist_items', 'description', 'TEXT');
    await safeAddColumn('wishlist_items', 'user_id', 'TEXT');
    await safeAddColumn('wishlist_items', 'username', 'TEXT');
    await safeAddColumn('wishlist_items', 'created_at', 'INTEGER');
    await safeAddColumn('wishlist_votes', 'created_at', 'INTEGER');
}

type GitHubLoginUserRow = {
    userId: string
    username: string | null
    email: string | null
    points: number
    isBlocked: boolean
    desktopNotificationsEnabled: boolean
    createdAt: Date | null
    lastLoginAt: Date | null
}

function toEpochMs(value: Date | number | string | null | undefined): number | null {
    if (value === null || value === undefined) return null
    if (value instanceof Date) return value.getTime()
    if (typeof value === 'number') return Number.isFinite(value) ? value : null
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
}

function pickCanonicalGitHubUser(rows: GitHubLoginUserRow[]) {
    const byRecentLoginDesc = [...rows].sort((a, b) => {
        const bTime = toEpochMs(b.lastLoginAt) || 0
        const aTime = toEpochMs(a.lastLoginAt) || 0
        if (bTime !== aTime) return bTime - aTime
        const aCreated = toEpochMs(a.createdAt) || 0
        const bCreated = toEpochMs(b.createdAt) || 0
        return aCreated - bCreated
    })

    const stableProviderId = byRecentLoginDesc.find((row) => /^github:\d+$/i.test(row.userId))
    if (stableProviderId) return stableProviderId

    const githubScoped = byRecentLoginDesc.find((row) => row.userId.toLowerCase().startsWith('github:'))
    if (githubScoped) return githubScoped

    return byRecentLoginDesc[0]
}

function normalizeGitHubUserIdValue(userId?: string | null): string | null {
    if (!userId) return null
    let normalized = userId.trim()
    while (normalized.toLowerCase().startsWith('github:')) {
        normalized = normalized.slice('github:'.length)
    }
    if (!normalized) return null
    return `github:${normalized}`
}

function normalizeGitHubUsernameValue(username?: string | null): string | null {
    if (!username) return null
    const normalized = username.trim().toLowerCase()
    if (!normalized) return null
    return normalized
}

function mergeLoginUserRows(primary: GitHubLoginUserRow, secondary: GitHubLoginUserRow) {
    const createdCandidates = [toEpochMs(primary.createdAt), toEpochMs(secondary.createdAt)].filter((value): value is number => value !== null)
    const lastLoginCandidates = [toEpochMs(primary.lastLoginAt), toEpochMs(secondary.lastLoginAt)].filter((value): value is number => value !== null)

    return {
        username: normalizeGitHubUsernameValue(primary.username) || normalizeGitHubUsernameValue(secondary.username),
        email: primary.email || secondary.email || null,
        points: Number(primary.points || 0) + Number(secondary.points || 0),
        isBlocked: !!primary.isBlocked || !!secondary.isBlocked,
        desktopNotificationsEnabled: !!primary.desktopNotificationsEnabled || !!secondary.desktopNotificationsEnabled,
        createdAt: createdCandidates.length ? new Date(Math.min(...createdCandidates)) : new Date(),
        lastLoginAt: lastLoginCandidates.length ? new Date(Math.max(...lastLoginCandidates)) : new Date(),
    }
}

async function runMigrationQuery(statement: any) {
    try {
        await db.run(statement)
    } catch (error: any) {
        if (!isMissingTableOrColumn(error)) throw error
    }
}

async function moveUserReferences(sourceUserId: string, targetUserId: string) {
    if (!sourceUserId || !targetUserId || sourceUserId === targetUserId) return

    await runMigrationQuery(sql`
        DELETE FROM broadcast_reads
        WHERE user_id = ${sourceUserId}
          AND EXISTS (
            SELECT 1
            FROM broadcast_reads br
            WHERE br.message_id = broadcast_reads.message_id
              AND br.user_id = ${targetUserId}
          )
    `)

    await runMigrationQuery(sql`
        DELETE FROM wishlist_votes
        WHERE user_id = ${sourceUserId}
          AND EXISTS (
            SELECT 1
            FROM wishlist_votes wv
            WHERE wv.item_id = wishlist_votes.item_id
              AND wv.user_id = ${targetUserId}
          )
    `)

    await runMigrationQuery(sql`UPDATE orders SET user_id = ${targetUserId} WHERE user_id = ${sourceUserId}`)
    await runMigrationQuery(sql`UPDATE reviews SET user_id = ${targetUserId} WHERE user_id = ${sourceUserId}`)
    await runMigrationQuery(sql`UPDATE refund_requests SET user_id = ${targetUserId} WHERE user_id = ${sourceUserId}`)
    await runMigrationQuery(sql`UPDATE daily_checkins_v2 SET user_id = ${targetUserId} WHERE user_id = ${sourceUserId}`)
    await runMigrationQuery(sql`UPDATE user_notifications SET user_id = ${targetUserId} WHERE user_id = ${sourceUserId}`)
    await runMigrationQuery(sql`UPDATE user_messages SET user_id = ${targetUserId} WHERE user_id = ${sourceUserId}`)
    await runMigrationQuery(sql`UPDATE broadcast_reads SET user_id = ${targetUserId} WHERE user_id = ${sourceUserId}`)
    await runMigrationQuery(sql`UPDATE wishlist_votes SET user_id = ${targetUserId} WHERE user_id = ${sourceUserId}`)
    await runMigrationQuery(sql`UPDATE wishlist_items SET user_id = ${targetUserId} WHERE user_id = ${sourceUserId}`)
    await runMigrationQuery(sql`UPDATE admin_messages SET target_value = ${targetUserId} WHERE target_type = 'userId' AND target_value = ${sourceUserId}`)
    await runMigrationQuery(sql`DELETE FROM login_users WHERE user_id = ${sourceUserId}`)
}

async function migrateMalformedGitHubUserIds() {
    await ensureLoginUsersSchema()

    const malformedRows = await db.select({
        userId: loginUsers.userId,
        username: loginUsers.username,
        email: loginUsers.email,
        points: loginUsers.points,
        isBlocked: sql<boolean>`COALESCE(${loginUsers.isBlocked}, FALSE)`,
        desktopNotificationsEnabled: sql<boolean>`COALESCE(${loginUsers.desktopNotificationsEnabled}, FALSE)`,
        createdAt: loginUsers.createdAt,
        lastLoginAt: loginUsers.lastLoginAt,
    })
        .from(loginUsers)
        .where(sql`LOWER(${loginUsers.userId}) LIKE 'github:github:%'`)

    if (!malformedRows.length) return

    for (const row of malformedRows) {
        const sourceUser: GitHubLoginUserRow = {
            userId: row.userId,
            username: row.username || null,
            email: row.email || null,
            points: Number(row.points || 0),
            isBlocked: !!row.isBlocked,
            desktopNotificationsEnabled: !!row.desktopNotificationsEnabled,
            createdAt: row.createdAt || null,
            lastLoginAt: row.lastLoginAt || null,
        }

        const targetUserId = normalizeGitHubUserIdValue(sourceUser.userId)
        if (!targetUserId || targetUserId === sourceUser.userId) continue

        const existingTargetRows = await db.select({
            userId: loginUsers.userId,
            username: loginUsers.username,
            email: loginUsers.email,
            points: loginUsers.points,
            isBlocked: sql<boolean>`COALESCE(${loginUsers.isBlocked}, FALSE)`,
            desktopNotificationsEnabled: sql<boolean>`COALESCE(${loginUsers.desktopNotificationsEnabled}, FALSE)`,
            createdAt: loginUsers.createdAt,
            lastLoginAt: loginUsers.lastLoginAt,
        })
            .from(loginUsers)
            .where(eq(loginUsers.userId, targetUserId))
            .limit(1)

        const existingTarget = existingTargetRows[0]
            ? {
                userId: existingTargetRows[0].userId,
                username: existingTargetRows[0].username || null,
                email: existingTargetRows[0].email || null,
                points: Number(existingTargetRows[0].points || 0),
                isBlocked: !!existingTargetRows[0].isBlocked,
                desktopNotificationsEnabled: !!existingTargetRows[0].desktopNotificationsEnabled,
                createdAt: existingTargetRows[0].createdAt || null,
                lastLoginAt: existingTargetRows[0].lastLoginAt || null,
            } satisfies GitHubLoginUserRow
            : null

        if (!existingTarget) {
            const createdAtMs = toEpochMs(sourceUser.createdAt) || Date.now()
            const lastLoginAtMs = toEpochMs(sourceUser.lastLoginAt) || Date.now()
            await runMigrationQuery(sql`
                INSERT OR IGNORE INTO login_users (
                    user_id,
                    username,
                    email,
                    points,
                    is_blocked,
                    desktop_notifications_enabled,
                    created_at,
                    last_login_at
                ) VALUES (
                    ${targetUserId},
                    NULL,
                    ${sourceUser.email},
                    ${sourceUser.points},
                    ${sourceUser.isBlocked ? 1 : 0},
                    ${sourceUser.desktopNotificationsEnabled ? 1 : 0},
                    ${createdAtMs},
                    ${lastLoginAtMs}
                )
            `)
        } else {
            const merged = mergeLoginUserRows(existingTarget, sourceUser)
            await db.update(loginUsers)
                .set({
                    username: merged.username,
                    email: merged.email,
                    points: merged.points,
                    isBlocked: merged.isBlocked,
                    desktopNotificationsEnabled: merged.desktopNotificationsEnabled,
                    createdAt: merged.createdAt,
                    lastLoginAt: merged.lastLoginAt,
                })
                .where(eq(loginUsers.userId, targetUserId))
        }

        await moveUserReferences(sourceUser.userId, targetUserId)

        const normalizedUsername = normalizeGitHubUsernameValue(sourceUser.username)
        if (normalizedUsername) {
            await runMigrationQuery(sql`
                UPDATE login_users
                SET username = ${normalizedUsername}
                WHERE user_id = ${targetUserId}
                  AND (username IS NULL OR username = '' OR LOWER(username) <> ${normalizedUsername})
            `)
        }
    }
}

async function migrateGitHubUsersDedupAndCanonicalize() {
    await ensureLoginUsersSchema()

    const githubUsers = await db.select({
        userId: loginUsers.userId,
        username: loginUsers.username,
        email: loginUsers.email,
        points: loginUsers.points,
        isBlocked: sql<boolean>`COALESCE(${loginUsers.isBlocked}, FALSE)`,
        desktopNotificationsEnabled: sql<boolean>`COALESCE(${loginUsers.desktopNotificationsEnabled}, FALSE)`,
        createdAt: loginUsers.createdAt,
        lastLoginAt: loginUsers.lastLoginAt,
    })
        .from(loginUsers)
        .where(sql`${loginUsers.username} IS NOT NULL AND LOWER(${loginUsers.username}) LIKE 'gh_%'`)

    if (!githubUsers.length) return

    const groups = new Map<string, GitHubLoginUserRow[]>()
    for (const row of githubUsers) {
        const normalizedUsername = (row.username || '').trim().toLowerCase()
        if (!normalizedUsername.startsWith('gh_')) continue
        const list = groups.get(normalizedUsername) || []
        list.push({
            userId: row.userId,
            username: row.username,
            email: row.email || null,
            points: Number(row.points || 0),
            isBlocked: !!row.isBlocked,
            desktopNotificationsEnabled: !!row.desktopNotificationsEnabled,
            createdAt: row.createdAt || null,
            lastLoginAt: row.lastLoginAt || null,
        })
        groups.set(normalizedUsername, list)
    }

    for (const [normalizedUsername, rows] of groups.entries()) {
        if (!rows.length) continue
        const canonical = pickCanonicalGitHubUser(rows)
        if (!canonical) continue

        const mergedPoints = rows.reduce((sum, row) => sum + Number(row.points || 0), 0)
        const mergedBlocked = rows.some((row) => row.isBlocked)
        const mergedDesktopNotifications = rows.some((row) => row.desktopNotificationsEnabled)
        const mergedEmail = canonical.email || rows.map((row) => row.email).find((value) => !!value) || null

        const createdCandidates = rows.map((row) => toEpochMs(row.createdAt)).filter((value): value is number => value !== null)
        const lastLoginCandidates = rows.map((row) => toEpochMs(row.lastLoginAt)).filter((value): value is number => value !== null)

        const mergedCreatedAt = createdCandidates.length
            ? new Date(Math.min(...createdCandidates))
            : (canonical.createdAt || new Date())
        const mergedLastLoginAt = lastLoginCandidates.length
            ? new Date(Math.max(...lastLoginCandidates))
            : (canonical.lastLoginAt || new Date())

        await db.update(loginUsers)
            .set({
                username: normalizedUsername,
                email: mergedEmail,
                points: mergedPoints,
                isBlocked: mergedBlocked,
                desktopNotificationsEnabled: mergedDesktopNotifications,
                createdAt: mergedCreatedAt,
                lastLoginAt: mergedLastLoginAt,
            })
            .where(eq(loginUsers.userId, canonical.userId))

        await runMigrationQuery(sql`
            UPDATE orders
            SET username = ${normalizedUsername}
            WHERE user_id = ${canonical.userId}
              AND (username IS NULL OR LOWER(username) NOT LIKE 'gh_%')
        `)
        await runMigrationQuery(sql`
            UPDATE reviews
            SET username = ${normalizedUsername}
            WHERE user_id = ${canonical.userId}
              AND (username IS NULL OR LOWER(username) NOT LIKE 'gh_%')
        `)
        await runMigrationQuery(sql`
            UPDATE refund_requests
            SET username = ${normalizedUsername}
            WHERE user_id = ${canonical.userId}
              AND (username IS NULL OR LOWER(username) NOT LIKE 'gh_%')
        `)
        await runMigrationQuery(sql`
            UPDATE user_messages
            SET username = ${normalizedUsername}
            WHERE user_id = ${canonical.userId}
              AND (username IS NULL OR LOWER(username) NOT LIKE 'gh_%')
        `)
        await runMigrationQuery(sql`
            UPDATE wishlist_items
            SET username = ${normalizedUsername}
            WHERE user_id = ${canonical.userId}
              AND (username IS NULL OR LOWER(username) NOT LIKE 'gh_%')
        `)

        for (const row of rows) {
            if (row.userId === canonical.userId) continue
            await moveUserReferences(row.userId, canonical.userId)
        }
    }
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
        await db.run(sql`
            INSERT INTO login_users(user_id, username, created_at, last_login_at)
            SELECT user_id, MAX(username) AS username, (unixepoch() * 1000), (unixepoch() * 1000)
            FROM (
                SELECT user_id, username FROM orders WHERE user_id IS NOT NULL AND user_id <> ''
                UNION ALL
                SELECT user_id, username FROM reviews WHERE user_id IS NOT NULL AND user_id <> ''
            )
            GROUP BY user_id
            ON CONFLICT(user_id) DO NOTHING
        `);
    } catch (error: any) {
        if (isMissingTable(error)) return;
        throw error;
    }

    await markLoginUsersBackfilled();
}

export async function recordLoginUser(userId: string, username?: string | null, email?: string | null) {
    if (!userId) return;

    try {
        const result = await db.insert(loginUsers).values({
            userId,
            username: username || null,
            email: email || null,
            lastLoginAt: new Date()
        }).onConflictDoUpdate({
            target: loginUsers.userId,
            set: { username: username || null, lastLoginAt: new Date() }
        });
        if ((result as any)?.meta?.changes === 1) {
            try {
                updateTag('home:visitors');
            } catch {
                // best effort
            }
        }
        if (email) {
            try {
                await db.run(sql`UPDATE login_users SET email = ${email} WHERE user_id = ${userId} AND (email IS NULL OR email = '')`);
            } catch {
                // best effort
            }
        }
    } catch (error: any) {
        if (isMissingTable(error) || error?.code === '42703' || error?.message?.includes('column')) {
            await ensureLoginUsersSchema();

            const result = await db.insert(loginUsers).values({
                userId,
                username: username || null,
                email: email || null,
                lastLoginAt: new Date()
            }).onConflictDoUpdate({
                target: loginUsers.userId,
                set: { username: username || null, lastLoginAt: new Date() }
            });
            if ((result as any)?.meta?.changes === 1) {
                try {
                    updateTag('home:visitors');
                } catch {
                    // best effort
                }
            }
            if (email) {
                try {
                    await db.run(sql`UPDATE login_users SET email = ${email} WHERE user_id = ${userId} AND (email IS NULL OR email = '')`);
                } catch {
                    // best effort
                }
            }
            return;
        }
        console.error('recordLoginUser error:', error);
    }
}

export async function getLoginUserEmail(userId: string): Promise<string | null> {
    if (!userId) return null;
    try {
        const result = await db.select({ email: loginUsers.email })
            .from(loginUsers)
            .where(eq(loginUsers.userId, userId))
            .limit(1);
        return result[0]?.email ?? null;
    } catch (error: any) {
        if (isMissingTableOrColumn(error)) return null;
        throw error;
    }
}

export async function updateLoginUserEmail(userId: string, email: string | null) {
    if (!userId) return;
    try {
        await ensureLoginUsersTable();
        await safeAddColumn('login_users', 'email', 'TEXT');
        await db.update(loginUsers)
            .set({ email: email || null, lastLoginAt: new Date() })
            .where(eq(loginUsers.userId, userId));
    } catch (error: any) {
        if (isMissingTableOrColumn(error)) return;
        throw error;
    }
}

export async function getLoginUserDesktopNotificationsEnabled(userId: string): Promise<boolean> {
    if (!userId) return false;
    try {
        const result = await db.select({ enabled: loginUsers.desktopNotificationsEnabled })
            .from(loginUsers)
            .where(eq(loginUsers.userId, userId))
            .limit(1);
        return Boolean(result[0]?.enabled);
    } catch (error: any) {
        if (isMissingTableOrColumn(error)) return false;
        throw error;
    }
}

export async function updateLoginUserDesktopNotificationsEnabled(userId: string, enabled: boolean) {
    if (!userId) return;
    try {
        await ensureLoginUsersSchema();
        await db.update(loginUsers)
            .set({ desktopNotificationsEnabled: enabled, lastLoginAt: new Date() })
            .where(eq(loginUsers.userId, userId));
    } catch (error: any) {
        if (isMissingTableOrColumn(error)) return;
        throw error;
    }
}

export async function cleanupExpiredCardsIfNeeded(throttleMs: number = 10 * 60 * 1000, productId?: string) {
    const now = Date.now();
    try {
        await ensureCardsColumns();
    } catch (error: any) {
        if (!isMissingTableOrColumn(error)) throw error;
        return false;
    }

    if (productId) {
        try {
            const hasExpired = await db.select({ id: cards.id })
                .from(cards)
                .where(and(
                    eq(cards.productId, productId),
                    sql`${cards.expiresAt} IS NOT NULL AND ${cards.expiresAt} < ${now}`
                ))
                .limit(1);
            if (hasExpired.length > 0) {
                throttleMs = 0;
            }
        } catch (error: any) {
            if (!isMissingTableOrColumn(error)) throw error;
        }
    }

    let lastRun = 0;
    try {
        const last = await getSetting('cards_expiry_cleanup_at');
        lastRun = Number(last || 0);
    } catch {
        // best effort
    }

    if (now - lastRun < throttleMs) return false;

    let affectedProductIds: string[] = [];
    try {
        const rows = await db.select({ productId: cards.productId })
            .from(cards)
            .where(sql`${cards.expiresAt} IS NOT NULL AND ${cards.expiresAt} < ${now}`);
        affectedProductIds = Array.from(new Set(rows.map((r) => r.productId).filter(Boolean)));
    } catch (error: any) {
        if (!isMissingTableOrColumn(error)) throw error;
    }

    try {
        await db.run(sql`DELETE FROM cards WHERE expires_at IS NOT NULL AND expires_at < ${now}`);
    } catch (error: any) {
        if (!isMissingTableOrColumn(error)) throw error;
    }

    if (affectedProductIds.length > 0) {
        try {
            await recalcProductAggregatesForMany(affectedProductIds);
        } catch {
            // best effort
        }
        try {
            updateTag('home:products');
            updateTag('home:product-categories');
        } catch {
            // best effort
        }
    }

    try {
        await setSetting('cards_expiry_cleanup_at', String(now));
    } catch {
        // best effort
    }

    return true;
}

export async function getVisitorCount(): Promise<number> {
    try {
        await backfillLoginUsersFromOrdersAndReviews();
        const result = await db.select({ count: sql<number>`count(*)` })
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
        await Promise.all([
            ensureOrdersColumns(),
            ensureCardsColumns(),
        ])
    } catch (error: any) {
        if (!isMissingTableOrColumn(error)) throw error
    }

    try {
        // No transaction - D1 doesn't support SQL transactions
        const fiveMinutesAgoMs = Date.now() - RESERVATION_TTL_MS;
        // Preselect expired orders because D1 may not return rows for UPDATE ... RETURNING
        const candidates = await db
            .select({ orderId: orders.orderId, productId: orders.productId })
            .from(orders)
            .where(and(
                eq(orders.status, 'pending'),
                lt(orders.createdAt, new Date(fiveMinutesAgoMs)),
                productId ? eq(orders.productId, productId) : sql`1=1`,
                userId ? eq(orders.userId, userId) : sql`1=1`,
                orderId ? eq(orders.orderId, orderId) : sql`1=1`
            ));

        const orderIds = candidates.map((row) => row.orderId).filter(Boolean);
        if (!orderIds.length) return orderIds;

        for (const expired of candidates) {
            const expiredOrderId = expired.orderId;
            if (!expiredOrderId) continue;
            try {
                // Mirror manual cancel behavior to guarantee release
                await db.update(cards)
                    .set({ reservedOrderId: null, reservedAt: null })
                    .where(eq(cards.reservedOrderId, expiredOrderId));
            } catch (error: any) {
                if (!isMissingTableOrColumn(error)) throw error;
            }
            await db.update(orders)
                .set({ status: 'cancelled' })
                .where(eq(orders.orderId, expiredOrderId));
        }

        const productIds = Array.from(new Set(candidates.map((row) => row.productId).filter(Boolean)));
        for (const pid of productIds) {
            try {
                await recalcProductAggregates(pid);
            } catch {
                // best effort
            }
        }
        try {
            updateTag('home:products');
            updateTag('home:product-categories');
        } catch {
            // best effort
        }
        try {
            revalidatePath('/orders');
            revalidatePath('/admin/orders');
            for (const expired of candidates) {
                if (expired.orderId) {
                    revalidatePath(`/order/${expired.orderId}`);
                }
            }
        } catch {
            // best effort
        }

        return orderIds;
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
        if (q) {
            const like = `%${q}%`
            whereClause = or(
                sql`${loginUsers.username} LIKE ${like}`,
                sql`${loginUsers.userId} LIKE ${like}`
            )
        }

        const itemsPromise = db.select({
            userId: loginUsers.userId,
            username: loginUsers.username,
            points: loginUsers.points,
            isBlocked: sql<boolean>`COALESCE(${loginUsers.isBlocked}, FALSE)`,
            lastLoginAt: loginUsers.lastLoginAt,
            createdAt: loginUsers.createdAt,
            orderCount: sql<number>`count(CASE WHEN ${orders.status} IN ('paid', 'delivered', 'refunded') THEN 1 END)`
        })
            .from(loginUsers)
            .leftJoin(orders, eq(loginUsers.userId, orders.userId))
            .where(whereClause)
            .groupBy(loginUsers.userId)
            .orderBy(desc(loginUsers.lastLoginAt))
            .limit(pageSize)
            .offset(offset)

        const countQuery = db.select({ count: sql<number>`count(DISTINCT ${loginUsers.userId})` })
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

export async function toggleUserBlock(userId: string, isBlocked: boolean) {
    await ensureLoginUsersTable();
    // Ensure column exists
    try {
        await db.run(sql.raw(`ALTER TABLE login_users ADD COLUMN is_blocked INTEGER DEFAULT 0`));
    } catch { /* duplicate column */ }

    await db.update(loginUsers)
        .set({ isBlocked })
        .where(eq(loginUsers.userId, userId));
}

export async function getUserPendingOrders(userId: string) {
    return await db.select({
        orderId: orders.orderId,
        createdAt: orders.createdAt,
        productName: orders.productName,
        amount: orders.amount
    })
        .from(orders)
        .where(and(
            eq(orders.userId, userId),
            eq(orders.status, 'pending')
        ))
        .orderBy(desc(normalizeTimestampMs(orders.createdAt)));
}
