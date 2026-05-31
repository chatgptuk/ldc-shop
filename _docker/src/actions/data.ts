"use server"

import { db } from "@/lib/db"
import { sql } from "drizzle-orm"
import { revalidatePath, updateTag } from "next/cache"
import { checkAdmin } from "@/actions/admin"
import { recalcProductAggregatesForMany } from "@/lib/db/queries"
import { products } from "@/lib/db/schema"

async function executeStatement(statement: string) {
    if (!statement.trim()) return
    try {
        await db.run(sql.raw(statement))
    } catch (e) {
        console.error('Import Error:', e)
        throw new Error(`Failed to execute statement: ${statement.substring(0, 50)}... ${e instanceof Error ? e.message : String(e)}`)
    }
}

async function repairTimestamps() {
    const timestampColumns = [
        { table: 'products', cols: ['created_at'] },
        { table: 'cards', cols: ['created_at', 'reserved_at', 'expires_at', 'used_at'] },
        { table: 'orders', cols: ['created_at', 'paid_at', 'delivered_at'] },
        { table: 'login_users', cols: ['created_at', 'last_login_at'] },
        { table: 'daily_checkins_v2', cols: ['created_at'] },
        { table: 'settings', cols: ['updated_at'] },
        { table: 'reviews', cols: ['created_at'] },
        { table: 'categories', cols: ['created_at', 'updated_at'] },
        { table: 'refund_requests', cols: ['created_at', 'updated_at', 'processed_at'] },
        { table: 'user_notifications', cols: ['created_at'] },
        { table: 'user_messages', cols: ['created_at'] },
        { table: 'admin_messages', cols: ['created_at'] },
        { table: 'broadcast_messages', cols: ['created_at'] },
        { table: 'broadcast_reads', cols: ['created_at'] },
    ]

    for (const { table, cols } of timestampColumns) {
        for (const col of cols) {
            try {
                // SQLite: Convert TEXT timestamps (e.g. '2023-01-01...') to INTEGER (Unix MS)
                // Only targets rows where column is currently TEXT
                // strftime('%s') returns seconds, so * 1000 for ms
                await db.run(sql.raw(`
                    UPDATE ${table} 
                    SET ${col} = CAST(strftime('%s', ${col}) AS INTEGER) * 1000 
                    WHERE typeof(${col}) = 'text' AND ${col} IS NOT NULL AND ${col} != ''
                `))
            } catch (e) {
                console.error(`Failed to repair timestamp for ${table}.${col}:`, e)
            }
        }
    }
}

export async function repairDataAction() {
    await checkAdmin()
    try {
        await repairTimestamps()
        return { success: true }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

export async function importData(formData: FormData) {
    await checkAdmin()

    const file = formData.get('file') as File
    if (!file) {
        return { success: false, error: 'No file provided' }
    }

    try {
        const text = await file.text()
        const lines = text.split('\n')

        // Comprehensive Column Mapping (CamelCase -> snake_case) for Vercel exports
        // This covers known differences between Vercel export (which uses property names) and D1 schema
        const columnMap: Record<string, string> = {
            // Products
            compareAtPrice: 'compare_at_price',
            maxPointsDiscount: 'max_points_discount',
            isHot: 'is_hot',
            isActive: 'is_active',
            isShared: 'is_shared',
            sortOrder: 'sort_order',
            purchaseLimit: 'purchase_limit',
            purchaseWarning: 'purchase_warning',
            visibilityLevel: 'visibility_level',
            stockCount: 'stock_count',
            lockedCount: 'locked_count',
            soldCount: 'sold_count',
            createdAt: 'created_at',
            // Cards
            productId: 'product_id',
            cardKey: 'card_key',
            isUsed: 'is_used',
            reservedOrderId: 'reserved_order_id',
            reservedAt: 'reserved_at',
            expiresAt: 'expires_at',
            usedAt: 'used_at',
            // Orders
            orderId: 'order_id',
            productName: 'product_name',
            tradeNo: 'trade_no',
            paidAt: 'paid_at',
            deliveredAt: 'delivered_at',
            userId: 'user_id',
            pointsUsed: 'points_used',
            currentPaymentId: 'current_payment_id',
            cardIds: 'card_ids',
            // Login Users
            lastLoginAt: 'last_login_at',
            isBlocked: 'is_blocked',
            // Refund Requests
            adminUsername: 'admin_username',
            adminNote: 'admin_note',
            processedAt: 'processed_at',
            // Settings
            updatedAt: 'updated_at',
            // Categories
            // icon, sortOrder covered already
        }

        let successCount = 0
        let errorCount = 0

        for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed || trimmed.startsWith('--')) continue

            // Regex to parse INSERT OR IGNORE INTO <table> (...) VALUES (...)
            const match = trimmed.match(/INSERT OR IGNORE INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\((.+)\);/i)

            if (match) {
                const table = match[1]
                const columnsStr = match[2]
                const valuesStr = match[3]

                const columns = columnsStr.split(',').map(c => c.trim())

                // Map table name
                const tableMap: Record<string, string> = {
                    'daily_checkins': 'daily_checkins_v2'
                }
                const targetTable = tableMap[table] || table

                // Map columns
                const newColumns = columns.map(c => columnMap[c] || c)

                // Reconstruct statement
                const newStatement = `INSERT OR IGNORE INTO ${targetTable} (${newColumns.join(', ')}) VALUES (${valuesStr});`

                try {
                    await executeStatement(newStatement)
                    successCount++
                } catch (e: any) {
                    const errorMsg = e?.message || String(e)
                    // Silently skip if table doesn't exist (Vercel export might have tables that Workers doesn't have)
                    if (errorMsg.includes('no such table') || errorMsg.includes('does not exist')) {
                        // Skip silently - this is expected for some tables
                    } else {
                        console.error('Failed statement:', newStatement, errorMsg)
                    }
                    errorCount++
                }
            } else if (trimmed.toUpperCase().startsWith('INSERT')) {
                // Try executing other INSERTs directly if they match simple format
                try {
                    await executeStatement(trimmed)
                    successCount++
                } catch (e) {
                    errorCount++
                }
            }
        }

        // Run repair regardless of insert success to fix any existing data issues
        await repairTimestamps()

        try {
            const productRows = await db.select({ id: products.id }).from(products);
            const productIds = productRows.map((r) => r.id).filter(Boolean);
            await recalcProductAggregatesForMany(productIds);
        } catch {
            // best effort
        }

        revalidatePath('/admin')
        updateTag('home:products')
        updateTag('home:ratings')
        updateTag('home:categories')
        updateTag('home:announcement')
        updateTag('home:product-categories')
        updateTag('home:visitors')
        return { success: true, count: successCount, errors: errorCount }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}
