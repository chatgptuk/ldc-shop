import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { orders } from "@/lib/db/schema"
import { eq, or } from "drizzle-orm"
import { notFound, redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { cookies } from "next/headers"
import { CreditCard, Package, Clock, Copy, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CopyButton } from "@/components/copy-button"

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

    // Admin bypass? (Not implemented here for now, kept safe)

    if (!canViewKey && order.status === 'delivered') {
        // If delivered and not owner, basic info only? Or 404/403?
        // Let's show basic info but hide key
    }

    return (
        <main className="container py-12 max-w-2xl">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Order Details</CardTitle>
                            <CardDescription className="font-mono mt-1">{order.orderId}</CardDescription>
                        </div>
                        <Badge variant={
                            order.status === 'delivered' ? 'default' :
                                order.status === 'paid' ? 'secondary' :
                                    order.status === 'refunded' ? 'destructive' : 'outline'
                        } className="uppercase">
                            {order.status}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-4">
                        <div className="flex justify-between items-center p-4 bg-muted/40 rounded-lg">
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-muted-foreground">Product</p>
                                <p className="font-semibold">{order.productName}</p>
                            </div>
                            <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center">
                                <Package className="h-5 w-5 text-primary" />
                            </div>
                        </div>

                        <div className="flex justify-between items-center p-4 bg-muted/40 rounded-lg">
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-muted-foreground">Amount Paid</p>
                                <p className="font-semibold text-lg">{Number(order.amount)} <span className="text-xs font-normal">Credits</span></p>
                            </div>
                            <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center">
                                <CreditCard className="h-5 w-5 text-primary" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-muted/20 rounded-lg">
                                <p className="text-xs text-muted-foreground mb-1">Created At</p>
                                <p className="text-sm font-medium">{order.createdAt ? new Date(order.createdAt).toLocaleString() : '-'}</p>
                            </div>
                            <div className="p-4 bg-muted/20 rounded-lg">
                                <p className="text-xs text-muted-foreground mb-1">Paid At</p>
                                <p className="text-sm font-medium">{order.paidAt ? new Date(order.paidAt).toLocaleString() : '-'}</p>
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {order.status === 'delivered' ? (
                        canViewKey ? (
                            <div className="space-y-3">
                                <h3 className="font-semibold flex items-center gap-2">
                                    <div className="h-2 w-2 rounded-full bg-green-500" />
                                    Your Content
                                </h3>
                                <div className="p-4 bg-slate-950 text-slate-50 font-mono rounded-lg break-all">
                                    {order.cardKey}
                                </div>
                                <CopyButton text={order.cardKey || ''} label="Click to copy:" />
                                <p className="text-xs text-muted-foreground">
                                    Please save this key securely.
                                </p>
                            </div>
                        ) : (
                            <div className="p-4 bg-yellow-50 text-yellow-800 rounded-lg flex gap-3 text-sm">
                                <AlertCircle className="h-5 w-5 shrink-0" />
                                <p>
                                    Please login with the account used to purchase to view the content.
                                </p>
                            </div>
                        )
                    ) : (
                        <div className="flex items-center gap-3 text-muted-foreground p-4 bg-muted/20 rounded-lg">
                            <Clock className="h-5 w-5" />
                            <p className="text-sm">
                                {order.status === 'paid'
                                    ? 'Payment received. Processing delivery...'
                                    : order.status === 'refunded'
                                        ? 'This order has been refunded.'
                                        : 'Waiting for payment...'}
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </main>
    )
}
