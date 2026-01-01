import { db } from "@/lib/db"
import { orders } from "@/lib/db/schema"
import { desc } from "drizzle-orm"
import { AdminOrdersContent } from "@/components/admin/orders-content"

export default async function AdminOrdersPage() {
    const allOrders = await db.query.orders.findMany({
        orderBy: [desc(orders.createdAt)],
        limit: 50
    })

    return (
        <AdminOrdersContent
            orders={allOrders.map(o => ({
                orderId: o.orderId,
                username: o.username,
                email: o.email,
                productName: o.productName,
                amount: o.amount,
                status: o.status,
                cardKey: o.cardKey,
                tradeNo: o.tradeNo,
                createdAt: o.createdAt
            }))}
        />
    )
}
