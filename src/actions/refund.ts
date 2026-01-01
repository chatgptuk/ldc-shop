'use server'

import { db } from "@/lib/db"
import { orders } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export async function getRefundParams(orderId: string) {
    // Auth Check
    const { auth } = await import("@/lib/auth")
    const session = await auth()
    const user = session?.user
    const adminUsers = process.env.ADMIN_USERS?.toLowerCase().split(',') || []
    if (!user || !user.username || !adminUsers.includes(user.username.toLowerCase())) {
        throw new Error("Unauthorized")
    }

    // Get Order
    const order = await db.query.orders.findFirst({
        where: eq(orders.orderId, orderId)
    })

    if (!order) throw new Error("Order not found")
    if (!order.tradeNo) throw new Error("Missing trade_no")

    // Return params for client-side form submission
    return {
        pid: process.env.MERCHANT_ID!,
        key: process.env.MERCHANT_KEY!,
        trade_no: order.tradeNo,
        out_trade_no: order.orderId,
        money: Number(order.amount).toFixed(2)
    }
}

export async function checkRefundStatus(orderId: string) {
    // Auth Check
    const { auth } = await import("@/lib/auth")
    const session = await auth()
    const user = session?.user
    const adminUsers = process.env.ADMIN_USERS?.toLowerCase().split(',') || []
    if (!user || !user.username || !adminUsers.includes(user.username.toLowerCase())) {
        throw new Error("Unauthorized")
    }

    // Get Order
    const order = await db.query.orders.findFirst({
        where: eq(orders.orderId, orderId)
    })

    if (!order) throw new Error("Order not found")
    if (!order.tradeNo) throw new Error("Missing trade_no")

    // Query order status from API
    const queryParams = new URLSearchParams({
        act: 'order',
        pid: process.env.MERCHANT_ID!,
        key: process.env.MERCHANT_KEY!,
        trade_no: order.tradeNo
    })

    const resp = await fetch(`https://credit.linux.do/epay/api.php?${queryParams}`, {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'User-Agent': 'LDC-Shop/1.0'
        }
    })

    const text = await resp.text()
    let result
    try {
        result = JSON.parse(text)
    } catch {
        throw new Error(`API Error: ${text.substring(0, 100)}`)
    }

    console.log("[CheckRefund] API result:", result)

    if (result.code === 1 && result.status === 0) {
        // status 0 means refunded/failed, update order
        await db.update(orders).set({ status: 'refunded' }).where(eq(orders.orderId, orderId))
        revalidatePath('/admin/orders')
        revalidatePath(`/order/${orderId}`)
        return { refunded: true, message: "Order has been refunded successfully" }
    } else if (result.code === 1 && result.status === 1) {
        return { refunded: false, message: "Order is still active (not yet refunded)" }
    } else {
        throw new Error(result.msg || "Failed to query order status")
    }
}
