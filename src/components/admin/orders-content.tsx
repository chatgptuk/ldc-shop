'use client'

import { useI18n } from "@/lib/i18n/context"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { RefundButton } from "@/components/admin/refund-button"
import { CopyButton } from "@/components/copy-button"

interface Order {
    orderId: string
    username: string | null
    email: string | null
    productName: string
    amount: string
    status: string | null
    cardKey: string | null
    tradeNo: string | null
    createdAt: Date | null
}

export function AdminOrdersContent({ orders }: { orders: Order[] }) {
    const { t } = useI18n()

    const getStatusBadgeVariant = (status: string | null) => {
        switch (status) {
            case 'delivered': return 'default' as const
            case 'paid': return 'secondary' as const
            case 'refunded': return 'destructive' as const
            default: return 'outline' as const
        }
    }

    const getStatusText = (status: string | null) => {
        if (!status) return t('order.status.pending')
        return t(`order.status.${status}`) || status
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">{t('admin.orders.title')}</h1>
            </div>

            <div className="rounded-md border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{t('admin.orders.orderId')}</TableHead>
                            <TableHead>{t('admin.orders.user')}</TableHead>
                            <TableHead>{t('admin.orders.product')}</TableHead>
                            <TableHead>{t('admin.orders.amount')}</TableHead>
                            <TableHead>{t('admin.orders.status')}</TableHead>
                            <TableHead>{t('admin.orders.cardKey')}</TableHead>
                            <TableHead>{t('admin.orders.date')}</TableHead>
                            <TableHead className="text-right">{t('admin.orders.actions')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {orders.map(order => (
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
                                    <Badge variant={getStatusBadgeVariant(order.status)} className="uppercase text-xs">
                                        {getStatusText(order.status)}
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
