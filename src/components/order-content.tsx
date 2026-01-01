'use client'

import { useI18n } from "@/lib/i18n/context"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { CreditCard, Package, Clock, AlertCircle } from "lucide-react"
import { CopyButton } from "@/components/copy-button"

interface Order {
    orderId: string
    productName: string
    amount: string
    status: string
    cardKey: string | null
    createdAt: Date | null
    paidAt: Date | null
}

interface OrderContentProps {
    order: Order
    canViewKey: boolean
}

export function OrderContent({ order, canViewKey }: OrderContentProps) {
    const { t } = useI18n()

    const getStatusBadgeVariant = (status: string) => {
        switch (status) {
            case 'delivered': return 'default'
            case 'paid': return 'secondary'
            case 'refunded': return 'destructive'
            default: return 'outline'
        }
    }

    const getStatusText = (status: string) => {
        return t(`order.status.${status}`) || status.toUpperCase()
    }

    const getStatusMessage = (status: string) => {
        switch (status) {
            case 'paid': return t('order.paymentReceived')
            case 'refunded': return t('order.orderRefunded')
            default: return t('order.waitingPayment')
        }
    }

    return (
        <main className="container py-12 max-w-2xl">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>{t('order.title')}</CardTitle>
                            <CardDescription className="font-mono mt-1">{order.orderId}</CardDescription>
                        </div>
                        <Badge variant={getStatusBadgeVariant(order.status)} className="uppercase">
                            {getStatusText(order.status)}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-4">
                        <div className="flex justify-between items-center p-4 bg-muted/40 rounded-lg">
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-muted-foreground">{t('order.product')}</p>
                                <p className="font-semibold">{order.productName}</p>
                            </div>
                            <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center">
                                <Package className="h-5 w-5 text-primary" />
                            </div>
                        </div>

                        <div className="flex justify-between items-center p-4 bg-muted/40 rounded-lg">
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-muted-foreground">{t('order.amountPaid')}</p>
                                <p className="font-semibold text-lg">{Number(order.amount)} <span className="text-xs font-normal">{t('common.credits')}</span></p>
                            </div>
                            <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center">
                                <CreditCard className="h-5 w-5 text-primary" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-muted/20 rounded-lg">
                                <p className="text-xs text-muted-foreground mb-1">{t('order.createdAt')}</p>
                                <p className="text-sm font-medium">{order.createdAt ? new Date(order.createdAt).toLocaleString() : '-'}</p>
                            </div>
                            <div className="p-4 bg-muted/20 rounded-lg">
                                <p className="text-xs text-muted-foreground mb-1">{t('order.paidAt')}</p>
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
                                    {t('order.yourContent')}
                                </h3>
                                <div className="relative p-4 bg-slate-950 text-slate-50 font-mono rounded-lg break-all whitespace-pre-wrap pr-12">
                                    {order.cardKey}
                                    <div className="absolute top-2 right-2">
                                        <CopyButton text={order.cardKey || ''} iconOnly />
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">
                                    {t('order.saveKeySecurely')}
                                </p>
                            </div>
                        ) : (
                            <div className="p-4 bg-yellow-50 text-yellow-800 rounded-lg flex gap-3 text-sm">
                                <AlertCircle className="h-5 w-5 shrink-0" />
                                <p>{t('order.loginToView')}</p>
                            </div>
                        )
                    ) : (
                        <div className="flex items-center gap-3 text-muted-foreground p-4 bg-muted/20 rounded-lg">
                            <Clock className="h-5 w-5" />
                            <p className="text-sm">{getStatusMessage(order.status)}</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </main>
    )
}
