'use server'

import { checkAdmin } from "./admin" // Need to export checkAdmin from admin.ts or move shared logic
import { db } from "@/lib/db"
import { orders } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { md5 } from "@/lib/crypto"

export async function refundOrder(orderId: string) {
    // 1. Auth Check
    // We can't easily import checkAdmin if it's not exported. Let's fix admin.ts first or duplicate check logic for speed.
    // Ideally we assume this is called from Admin context, but must verify.
    // For now, let's just do the fetch call logic assuming the route handler protects it or we add the check.
    // ACTUALLY, Server Actions must be secure.

    // We will assume checkAdmin is available or we add it here inline.
    // To avoid circular deps if admin.ts imports db, etc, we'll just check auth again.
    const { auth } = await import("@/lib/auth")
    const session = await auth()
    const user = session?.user
    const adminUsers = process.env.ADMIN_USERS?.toLowerCase().split(',') || []
    if (!user || !user.username || !adminUsers.includes(user.username.toLowerCase())) {
        throw new Error("Unauthorized")
    }

    // 2. Get Order
    const order = await db.query.orders.findFirst({
        where: eq(orders.orderId, orderId)
    })

    if (!order) throw new Error("Order not found")
    if (!order.tradeNo) throw new Error("Missing trade_no")

    // 3. Call Refund API
    const params: Record<string, any> = {
        pid: process.env.MERCHANT_ID!,
        key: process.env.MERCHANT_KEY!,
        trade_no: order.tradeNo,
        out_trade_no: order.orderId,
        money: Number(order.amount).toFixed(2) // Must match original amount with 2 decimal places
    }

    console.log("[Refund] Calling API with params:", JSON.stringify(params))

    const resp = await fetch('https://credit.linux.do/epay/api.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
        },
        body: new URLSearchParams(params)
    })

    const text = await resp.text()
    let result
    try {
        result = JSON.parse(text)
    } catch {
        throw new Error(`Refund API Error: ${text.substring(0, 100)}`)
    }

    if (result.code === 1) {
        await db.update(orders).set({ status: 'refunded' }).where(eq(orders.orderId, orderId))
        revalidatePath('/admin/orders')
        revalidatePath(`/order/${orderId}`)
    } else {
        throw new Error(`Refund Failed: ${result.msg}`)
    }
}
