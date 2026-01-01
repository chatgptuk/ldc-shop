'use client'

import { useI18n } from "@/lib/i18n/context"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Package, Search } from "lucide-react"

interface Order {
    orderId: string
    productName: string
    amount: string
    status: string | null
    createdAt: Date | null
}

export function OrdersContent({ orders }: { orders: Order[] }) {
    const { t } = useI18n()

    const getStatusBadgeVariant = (status: string | null) => {
        switch (status) {
            case 'delivered': return 'default' as const
            case 'paid': return 'secondary' as const
            default: return 'outline' as const
        }
    }

    const getStatusText = (status: string | null) => {
        if (!status) return t('order.status.pending')
        return t(`order.status.${status}`) || status
    }

    return (
        <main className="container py-12">
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-bold tracking-tight">{t('orders.title')}</h1>
                <p className="text-muted-foreground">{orders.length} orders</p>
            </div>

            <div className="grid gap-4">
                {orders.length > 0 ? (
                    orders.map(order => (
                        <Link href={`/order/${order.orderId}`} key={order.orderId}>
                            <Card className="hover:border-primary/50 transition-colors">
                                <div className="flex items-center p-6 gap-4">
                                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center shrink-0">
                                        <Package className="h-6 w-6 text-muted-foreground" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <h3 className="font-semibold truncate">{order.productName}</h3>
                                            <span className="font-bold">{Number(order.amount)} {t('common.credits')}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                                            <span className="font-mono">{order.orderId}</span>
                                            <span>{order.createdAt ? new Date(order.createdAt).toLocaleDateString() : ''}</span>
                                        </div>
                                    </div>
                                    <Badge variant={getStatusBadgeVariant(order.status)} className="ml-2 capitalize">
                                        {getStatusText(order.status)}
                                    </Badge>
                                </div>
                            </Card>
                        </Link>
                    ))
                ) : (
                    <div className="text-center py-20 rounded-lg border border-dashed">
                        <div className="flex justify-center mb-4">
                            <Search className="h-10 w-10 text-muted-foreground/50" />
                        </div>
                        <h3 className="font-semibold text-lg">{t('orders.noOrders')}</h3>
                        <p className="text-muted-foreground mb-6"></p>
                        <Link href="/" className="text-primary hover:underline">{t('orders.browseProducts')}</Link>
                    </div>
                )}
            </div>
        </main>
    )
}
