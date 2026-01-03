'use client'

import { useI18n } from "@/lib/i18n/context"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { CreditCard, Package, Clock, AlertCircle, CheckCircle2 } from "lucide-react"
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
            case 'paid': return t('order.stockDepleted')
            case 'refunded': return t('order.orderRefunded')
            default: return t('order.waitingPayment')
        }
    }

    return (
        <main className="container py-12 max-w-2xl">
            <Card className="tech-card overflow-hidden">
                <CardHeader className="relative">
                    {/* Status glow effect */}
                    {order.status === 'delivered' && (
                        <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full blur-3xl" />
                    )}

                    <div className="flex items-center justify-between gap-4">
                        <div className="space-y-1">
                            <CardTitle className="text-xl">{t('order.title')}</CardTitle>
                            <CardDescription className="font-mono text-xs bg-muted/50 px-2 py-1 rounded inline-block">
                                {order.orderId}
                            </CardDescription>
                        </div>
                        <Badge
                            variant={getStatusBadgeVariant(order.status)}
                            className={`uppercase text-xs tracking-wider ${order.status === 'delivered' ? 'bg-green-500/10 text-green-500 border-green-500/30' : ''}`}
                        >
                            {getStatusText(order.status)}
                        </Badge>
                    </div>
                </CardHeader>

                <CardContent className="space-y-6">
                    {/* Info Cards */}
                    <div className="grid gap-4">
                        {/* Product Info */}
                        <div className="flex justify-between items-center p-4 bg-gradient-to-r from-muted/40 to-muted/20 rounded-xl border border-border/30">
                            <div className="space-y-1">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('order.product')}</p>
                                <p className="font-semibold">{order.productName}</p>
                            </div>
                            <div className="h-12 w-12 bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl flex items-center justify-center border border-primary/20">
                                <Package className="h-5 w-5 text-primary" />
                            </div>
                        </div>

                        {/* Amount Info */}
                        <div className="flex justify-between items-center p-4 bg-gradient-to-r from-muted/40 to-muted/20 rounded-xl border border-border/30">
                            <div className="space-y-1">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('order.amountPaid')}</p>
                                <p className="font-semibold text-xl">
                                    <span className="gradient-text">{Number(order.amount)}</span>
                                    <span className="text-xs font-normal text-muted-foreground ml-1.5">{t('common.credits')}</span>
                                </p>
                            </div>
                            <div className="h-12 w-12 bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl flex items-center justify-center border border-primary/20">
                                <CreditCard className="h-5 w-5 text-primary" />
                            </div>
                        </div>

                        {/* Time Info */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-4 bg-muted/20 rounded-xl border border-border/20">
                                <p className="text-xs text-muted-foreground mb-1.5 uppercase tracking-wider">{t('order.createdAt')}</p>
                                <p className="text-sm font-medium">{order.createdAt ? new Date(order.createdAt).toLocaleString() : '-'}</p>
                            </div>
                            <div className="p-4 bg-muted/20 rounded-xl border border-border/20">
                                <p className="text-xs text-muted-foreground mb-1.5 uppercase tracking-wider">{t('order.paidAt')}</p>
                                <p className="text-sm font-medium">{order.paidAt ? new Date(order.paidAt).toLocaleString() : '-'}</p>
                            </div>
                        </div>
                    </div>

                    <Separator className="bg-border/50" />

                    {/* Content Display */}
                    {order.status === 'delivered' ? (
                        canViewKey ? (
                            <div className="space-y-4">
                                <h3 className="font-semibold flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                    {t('order.yourContent')}
                                </h3>
                                {/* Terminal-style display */}
                                <div className="relative group">
                                    <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/50 to-accent/50 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-300" />
                                    <div className="relative p-4 bg-slate-950 rounded-xl font-mono text-sm text-slate-100 break-all whitespace-pre-wrap pr-14 border border-slate-800">
                                        <div className="absolute top-2 left-4 flex gap-1.5">
                                            <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                                            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                                            <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                                        </div>
                                        <div className="mt-4">
                                            {order.cardKey}
                                        </div>
                                        <div className="absolute top-3 right-3">
                                            <CopyButton text={order.cardKey || ''} iconOnly />
                                        </div>
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    {t('order.saveKeySecurely')}
                                </p>
                            </div>
                        ) : (
                            <div className="p-4 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 rounded-xl flex gap-3 text-sm border border-yellow-500/20">
                                <AlertCircle className="h-5 w-5 shrink-0" />
                                <p>{t('order.loginToView')}</p>
                            </div>
                        )
                    ) : (
                        <div className={`flex items-center gap-3 p-4 rounded-xl border ${order.status === 'paid'
                                ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
                                : 'bg-muted/20 text-muted-foreground border-border/30'
                            }`}>
                            {order.status === 'paid' ? (
                                <AlertCircle className="h-5 w-5" />
                            ) : (
                                <Clock className="h-5 w-5" />
                            )}
                            <p className="text-sm">{getStatusMessage(order.status)}</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </main>
    )
}
