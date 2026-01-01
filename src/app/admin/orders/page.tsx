import { db } from "@/lib/db"
import { orders } from "@/lib/db/schema"
import { desc } from "drizzle-orm"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { RefundButton } from "@/components/admin/refund-button"
import { CopyButton } from "@/components/copy-button"

export default async function AdminOrdersPage() {
    const allOrders = await db.query.orders.findMany({
        orderBy: [desc(orders.createdAt)],
        limit: 50
    })

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">Recent Orders</h1>
            </div>

            <div className="rounded-md border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Order ID</TableHead>
                            <TableHead>User</TableHead>
                            <TableHead>Product</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Card Key</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {allOrders.map(order => (
                            <TableRow key={order.orderId}>
                                <TableCell className="font-mono text-xs">{order.orderId}</TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span className="font-medium text-sm">{order.username || 'Guest'}</span>
                                        <span className="text-xs text-muted-foreground">{order.email}</span>
                                    </div>
                                </TableCell>
                                <TableCell>{order.productName}</TableCell>
                                <TableCell>{Number(order.amount)}</TableCell>
                                <TableCell>
                                    <Badge variant={
                                        order.status === 'delivered' ? 'default' :
                                            order.status === 'paid' ? 'secondary' :
                                                order.status === 'refunded' ? 'destructive' : 'outline'
                                    } className="uppercase text-xs">
                                        {order.status}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    {order.cardKey ? (
                                        <CopyButton text={order.cardKey} truncate maxLength={15} />
                                    ) : (
                                        <span className="text-muted-foreground">-</span>
                                    )}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-xs">
                                    {order.createdAt ? new Date(order.createdAt).toLocaleString() : ''}
                                </TableCell>
                                <TableCell className="text-right">
                                    <RefundButton order={order} />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
