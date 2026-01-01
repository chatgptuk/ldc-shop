import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { orders } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { notFound } from "next/navigation"
import { cookies } from "next/headers"
import { OrderContent } from "@/components/order-content"

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const session = await auth()
    const user = session?.user

    const order = await db.query.orders.findFirst({
        where: eq(orders.orderId, id)
    })

    if (!order) return notFound()

    // Access Control
    let canViewKey = false
    if (user && (user.id === order.userId || user.username === order.username)) canViewKey = true

    // Check Cookie
    const cookieStore = await cookies()
    const pending = cookieStore.get('ldc_pending_order')
    if (pending?.value === id) canViewKey = true

    return (
        <OrderContent
            order={{
                orderId: order.orderId,
                productName: order.productName,
                amount: order.amount,
                status: order.status || 'pending',
                cardKey: order.cardKey,
                createdAt: order.createdAt,
                paidAt: order.paidAt
            }}
            canViewKey={canViewKey}
        />
    )
}
