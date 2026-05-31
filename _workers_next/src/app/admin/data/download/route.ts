import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import {
  orders,
  reviews,
  reviewReplies,
  settings,
  products,
  cards,
  loginUsers,
  categories,
  refundRequests,
  dailyCheckins,
  userNotifications,
  userMessages,
  adminMessages,
  broadcastMessages,
  broadcastReads,
  wishlistItems,
  wishlistVotes,
} from "@/lib/db/schema"
import { and, desc, eq, or, sql } from "drizzle-orm"
import { getProducts, normalizeTimestampMs } from "@/lib/db/queries"

function requireAdminUsername(username?: string | null) {
  const adminUsers = process.env.ADMIN_USERS?.toLowerCase().split(",") || []
  if (!username || !adminUsers.includes(username.toLowerCase())) {
    throw new Error("Unauthorized")
  }
}

function isMissingTable(error: any) {
  const errorString = JSON.stringify(error)
  return (
    error?.message?.includes("does not exist") ||
    error?.cause?.message?.includes("does not exist") ||
    errorString.includes("42P01") ||
    (errorString.includes("relation") && errorString.includes("does not exist"))
  )
}

function csvEscape(value: any): string {
  if (value === null || value === undefined) return ""
  const str = String(value)
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

function toCsv(headers: string[], rows: Array<Record<string, any>>): string {
  const lines: string[] = []
  lines.push(headers.map(csvEscape).join(","))
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(","))
  }
  return lines.join("\n") + "\n"
}

function csvResponse(csv: string, filename: string) {
  return new NextResponse(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}

function escapeString(val: string): string {
  return "'" + val.replace(/'/g, "''") + "'"
}

function formatSqlValue(val: any): string {
  if (val === null || val === undefined) return "NULL"
  if (typeof val === "boolean") return val ? "1" : "0"
  if (val instanceof Date) {
    // Check if valid date
    if (isNaN(val.getTime())) return "NULL"
    return "'" + val.toISOString().replace("T", " ").replace("Z", "") + "'"
  }
  if (typeof val === "number") return String(val)
  if (typeof val === "string") return escapeString(val)
  return escapeString(JSON.stringify(val))
}

function rowToInsertOrIgnore(table: string, row: Record<string, any>): string {
  const keys = Object.keys(row)
  const columns = keys.join(", ")
  const values = keys.map((k) => formatSqlValue(row[k])).join(", ")
  return `INSERT OR IGNORE INTO ${table} (${columns}) VALUES (${values});`
}

export async function GET(req: Request) {
  const session = await auth()
  requireAdminUsername(session?.user?.username ?? null)

  const { searchParams } = new URL(req.url)
  const type = (searchParams.get("type") || "").toLowerCase()
  const format = (searchParams.get("format") || "").toLowerCase()
  const includeSecrets = searchParams.get("includeSecrets") === "1"
  const q = (searchParams.get("q") || "").trim()
  const status = (searchParams.get("status") || "all").trim()
  const fulfillment = (searchParams.get("fulfillment") || "all").trim()

  try {
    if (type === "orders") {
      const whereParts: any[] = []
      if (status !== 'all') whereParts.push(eq(orders.status, status))
      if (fulfillment === 'needsDelivery') whereParts.push(and(eq(orders.status, 'paid'), sql`${orders.cardKey} IS NULL`))
      if (q) {
        const like = `%${q}%`
        whereParts.push(or(
          sql`${orders.orderId} LIKE ${like}`,
          sql`${orders.productName} LIKE ${like}`,
          sql`COALESCE(${orders.username}, '') LIKE ${like}`,
          sql`COALESCE(${orders.email}, '') LIKE ${like}`,
          sql`COALESCE(${orders.tradeNo}, '') LIKE ${like}`
        ))
      }
      const whereExpr = whereParts.length ? and(...whereParts) : undefined

      const orderRows = await db.query.orders.findMany({
        where: whereExpr,
        orderBy: [desc(normalizeTimestampMs(orders.createdAt))],
      })
      const mapped = orderRows.map((o: any) => ({
        orderId: o.orderId,
        username: o.username,
        email: includeSecrets ? o.email : null,
        productId: o.productId,
        productName: o.productName,
        amount: o.amount,
        status: o.status,
        tradeNo: includeSecrets ? o.tradeNo : null,
        cardKey: includeSecrets ? o.cardKey : null,
        cardIds: includeSecrets ? o.cardIds : null,
        createdAt: o.createdAt,
        paidAt: o.paidAt,
        deliveredAt: o.deliveredAt,
        userId: o.userId,
      }))

      if (format === "json") {
        return NextResponse.json(mapped, {
          headers: {
            "Content-Disposition": `attachment; filename="orders.json"`,
          },
        })
      }

      if (format === "csv") {
        const headers = [
          "orderId",
          "username",
          "email",
          "productId",
          "productName",
          "amount",
          "status",
          "tradeNo",
          "cardKey",
          "cardIds",
          "createdAt",
          "paidAt",
          "deliveredAt",
          "userId",
        ]
        const csv = toCsv(headers, mapped as any)
        return csvResponse(csv, `orders${includeSecrets ? "-with-secrets" : ""}.csv`)
      }
    }

    if (type === "products") {
      const rows = await getProducts()
      const mapped = rows.map((p: any) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        price: p.price,
        maxPointsDiscount: p.maxPointsDiscount,
        category: p.category,
        image: p.image,
        isActive: p.isActive ?? true,
        sortOrder: p.sortOrder ?? 0,
        purchaseLimit: p.purchaseLimit,
        visibilityLevel: p.visibilityLevel ?? -1,
        stock: p.stock,
        sold: p.sold,
      }))

      if (format === "json") {
        return NextResponse.json(mapped, {
          headers: {
            "Content-Disposition": `attachment; filename="products.json"`,
          },
        })
      }

      if (format === "csv") {
        const headers = [
          "id",
          "name",
          "description",
          "price",
          "maxPointsDiscount",
          "category",
          "image",
          "isActive",
          "sortOrder",
          "purchaseLimit",
          "visibilityLevel",
          "stock",
          "sold",
        ]
        const csv = toCsv(headers, mapped as any)
        return csvResponse(csv, "products.csv")
      }
    }

    if (type === "reviews") {
      const rows = await db.query.reviews.findMany({
        orderBy: [desc(reviews.createdAt)],
      })
      const mapped = rows.map((r: any) => ({
        id: r.id,
        productId: r.productId,
        orderId: r.orderId,
        userId: r.userId,
        username: r.username,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
      }))

      if (format === "json") {
        return NextResponse.json(mapped, {
          headers: {
            "Content-Disposition": `attachment; filename="reviews.json"`,
          },
        })
      }

      if (format === "csv") {
        const headers = [
          "id",
          "productId",
          "orderId",
          "userId",
          "username",
          "rating",
          "comment",
          "createdAt",
        ]
        const csv = toCsv(headers, mapped as any)
        return csvResponse(csv, "reviews.csv")
      }
    }

    if (type === "settings") {
      const rows = await db.query.settings.findMany({
        orderBy: [desc(settings.updatedAt)],
      })
      const mapped = rows.map((s: any) => ({
        key: s.key,
        value: s.value,
        updatedAt: s.updatedAt,
      }))
      return NextResponse.json(mapped, {
        headers: {
          "Content-Disposition": `attachment; filename="settings.json"`,
        },
      })
    }

    if (type === "full") {
      const full: Record<string, any[]> = {}
      const tables: Array<[string, () => Promise<any[]>]> = [
        ["categories", () => db.select().from(categories).all()],
        ["products", () => db.select().from(products).all()],
        ["cards", () => db.select().from(cards).all()],
        ["orders", () => db.select().from(orders).all()],
        ["reviews", () => db.select().from(reviews).all()],
        ["review_replies", () => db.select().from(reviewReplies).all()],
        ["settings", () => db.select().from(settings).all()],
        ["login_users", () => db.select().from(loginUsers).all()],
        ["user_notifications", () => db.select().from(userNotifications).all()],
        ["user_messages", () => db.select().from(userMessages).all()],
        ["admin_messages", () => db.select().from(adminMessages).all()],
        ["broadcast_messages", () => db.select().from(broadcastMessages).all()],
        ["broadcast_reads", () => db.select().from(broadcastReads).all()],
        ["wishlist_items", () => db.select().from(wishlistItems).all()],
        ["wishlist_votes", () => db.select().from(wishlistVotes).all()],
        ["refund_requests", () => db.select().from(refundRequests).all()],
        ["daily_checkins_v2", () => db.select().from(dailyCheckins).all()],
      ]

      for (const [tableName, fetcher] of tables) {
        try {
          full[tableName] = await fetcher()
        } catch (e: any) {
          if (isMissingTable(e)) full[tableName] = []
          else throw e
        }
      }

      if (format === "json") {
        return NextResponse.json(full, {
          headers: {
            "Content-Disposition": `attachment; filename="full-dump.json"`,
          },
        })
      }

      if (format === "sql") {
        const parts: string[] = []
        parts.push(`-- Database Migration Dump (Vercel Postgres -> Cloudflare D1)`)
        parts.push(`-- Generated at ${new Date().toISOString()}`)
        parts.push(``)
        parts.push(`-- Note: Transaction statements removed for D1 compatibility`)
        parts.push(``)

        // Map camelCase keys to snake_case for SQL export
        const columnMapping: Record<string, string> = {
          userId: 'user_id',
          productId: 'product_id',
          orderId: 'order_id',
          reviewId: 'review_id',
          itemId: 'item_id',
          messageId: 'message_id',
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
          reviewCount: 'review_count',
          variantGroupId: 'variant_group_id',
          variantLabel: 'variant_label',
          purchaseQuestions: 'purchase_questions',
          productImages: 'product_images',
          createdAt: 'created_at',
          // Cards
          cardKey: 'card_key',
          isUsed: 'is_used',
          reservedOrderId: 'reserved_order_id',
          reservedAt: 'reserved_at',
          expiresAt: 'expires_at',
          usedAt: 'used_at',
          // Orders
          productName: 'product_name',
          tradeNo: 'trade_no',
          paidAt: 'paid_at',
          deliveredAt: 'delivered_at',
          pointsUsed: 'points_used',
          currentPaymentId: 'current_payment_id',
          cardIds: 'card_ids',
          // Reviews
          // orderId, productId, userId already covered
          // Settings
          updatedAt: 'updated_at',
          // Login Users
          lastLoginAt: 'last_login_at',
          lastCheckinAt: 'last_checkin_at',
          consecutiveDays: 'consecutive_days',
          isBlocked: 'is_blocked',
          desktopNotificationsEnabled: 'desktop_notifications_enabled',
          // Refund Requests
          adminUsername: 'admin_username',
          adminNote: 'admin_note',
          processedAt: 'processed_at',
          // Notification / message tables
          titleKey: 'title_key',
          contentKey: 'content_key',
          isRead: 'is_read',
          // Broadcast / admin messages
          targetType: 'target_type',
          targetValue: 'target_value',
        }

        for (const [tableName, rows] of Object.entries(full)) {
          if (!rows.length) continue
          for (const row of rows) {
            // Convert keys to snake_case
            const sqlRow: Record<string, any> = {}
            for (const [key, val] of Object.entries(row)) {
              const sqlKey = columnMapping[key] || key
              sqlRow[sqlKey] = val
            }
            parts.push(rowToInsertOrIgnore(tableName, sqlRow))
          }
          parts.push(``)
        }

        parts.push(`-- End of Dump`)
        parts.push(``)

        const sqlText = parts.join("\n")
        return new NextResponse(sqlText, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Content-Disposition": `attachment; filename="migration_data.sql"`,
          },
        })
      }
    }

    return NextResponse.json({ error: "Bad Request" }, { status: 400 })
  } catch (e: any) {
    const message = e?.message || "Export failed"
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 })
  }
}
