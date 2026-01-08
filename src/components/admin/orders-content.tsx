'use client'

import { useEffect, useMemo, useState } from "react"
import { useI18n } from "@/lib/i18n/context"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { RefundButton } from "@/components/admin/refund-button"
import { CopyButton } from "@/components/copy-button"
import { ClientDate } from "@/components/client-date"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { AdminOrderActions } from "@/components/admin/order-actions"
import { deleteOrders } from "@/actions/admin-orders"
import { toast } from "sonner"

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

function buildUrl(params: Record<string, string | number | undefined | null>) {
    const sp = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
        if (v === undefined || v === null) return
        const str = String(v).trim()
        if (!str) return
        sp.set(k, str)
    })
    const qs = sp.toString()
    return qs ? `/admin/orders?${qs}` : '/admin/orders'
}

function exportUrl(params: Record<string, string | number | undefined | null>) {
    const sp = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
        if (v === undefined || v === null) return
        const str = String(v).trim()
        if (!str) return
        sp.set(k, str)
    })
    return `/admin/export/download?${sp.toString()}`
}

export function AdminOrdersContent({
    orders,
    total,
    page,
    pageSize,
    query,
    status,
    fulfillment,
}: {
    orders: Order[]
    total: number
    page: number
    pageSize: number
    query: string
    status: string
    fulfillment: string
}) {
    const { t } = useI18n()
    const router = useRouter()
    const [queryValue, setQueryValue] = useState(query || "")
    const [statusValue, setStatusValue] = useState<string>(status || "all")
    const [fulfillmentValue, setFulfillmentValue] = useState<string>(fulfillment || "all")
    const [selected, setSelected] = useState<Record<string, boolean>>({})

    const getStatusBadgeVariant = (status: string | null) => {
        switch (status) {
            case 'delivered': return 'default' as const
            case 'paid': return 'secondary' as const
            case 'refunded': return 'destructive' as const
            case 'cancelled': return 'secondary' as const
            default: return 'outline' as const
        }
    }

    const getStatusText = (status: string | null) => {
        if (!status) return t('order.status.pending')
        return t(`order.status.${status}`) || status
    }

    useEffect(() => {
        setQueryValue(query || "")
    }, [query])

    useEffect(() => {
        setStatusValue(status || "all")
    }, [status])

    useEffect(() => {
        setFulfillmentValue(fulfillment || "all")
    }, [fulfillment])

    useEffect(() => {
        setSelected({})
    }, [orders, page, status, fulfillment, query])

    const statusOptions = [
        { key: 'all', label: t('common.all') },
        { key: 'pending', label: t('order.status.pending') },
        { key: 'paid', label: t('order.status.paid') },
        { key: 'delivered', label: t('order.status.delivered') },
        { key: 'refunded', label: t('order.status.refunded') },
        { key: 'cancelled', label: t('order.status.cancelled') },
    ]

    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const canPrev = page > 1
    const canNext = page < totalPages
    const showingFrom = total === 0 ? 0 : (page - 1) * pageSize + 1
    const showingTo = Math.min(page * pageSize, total)

    const applyFilters = (next: { q?: string; status?: string; page?: number }) => {
        router.push(buildUrl({
            q: next.q ?? queryValue,
            status: next.status ?? statusValue,
            fulfillment: fulfillmentValue,
            page: next.page ?? 1,
            pageSize,
        }))
    }

    const applyAllFilters = (next: { q?: string; status?: string; fulfillment?: string; page?: number; pageSize?: number }) => {
        const nextStatus = next.status ?? statusValue
        const nextFulfillment = next.fulfillment ?? fulfillmentValue
        router.push(buildUrl({
            q: next.q ?? queryValue,
            status: nextStatus,
            fulfillment: nextFulfillment,
            page: next.page ?? 1,
            pageSize: next.pageSize ?? pageSize,
        }))
    }

    const selectedIds = useMemo(() => Object.keys(selected).filter((k) => selected[k]), [selected])
    const allOnPageSelected = orders.length > 0 && selectedIds.length === orders.length

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">{t('admin.orders.title')}</h1>
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <Input
                    value={queryValue}
                    onChange={(e) => setQueryValue(e.target.value)}
                    placeholder={t('admin.orders.searchPlaceholder')}
                    className="md:w-[360px]"
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') applyFilters({ q: queryValue, page: 1 })
                    }}
                />
                <div className="flex flex-wrap gap-2">
                    {statusOptions.map(s => (
                        <Button
                            key={s.key}
                            type="button"
                            variant={statusValue === s.key ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => {
                                setStatusValue(s.key)
                                applyAllFilters({ status: s.key, page: 1 })
                            }}
                        >
                            {s.label}
                        </Button>
                    ))}
                </div>
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap gap-2">
                    {[
                        { key: 'all', label: t('admin.orders.fulfillmentAll') },
                        { key: 'needsDelivery', label: t('admin.orders.needsDelivery') },
                    ].map((f) => (
                        <Button
                            key={f.key}
                            type="button"
                            variant={fulfillmentValue === f.key ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => {
                                setFulfillmentValue(f.key)
                                // Avoid contradictory filters
                                const nextStatus = f.key === 'needsDelivery' ? 'all' : statusValue
                                setStatusValue(nextStatus)
                                applyAllFilters({ fulfillment: f.key, status: nextStatus, page: 1 })
                            }}
                        >
                            {f.label}
                        </Button>
                    ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm text-muted-foreground">
                        {t('admin.orders.selectedCount', { count: selectedIds.length })}
                    </div>
                    <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={!selectedIds.length}
                        onClick={async () => {
                            if (!confirm(t('admin.orders.confirmDeleteSelected'))) return
                            try {
                                await deleteOrders(selectedIds)
                                toast.success(t('common.success'))
                                setSelected({})
                                router.refresh()
                            } catch (e: any) {
                                toast.error(e.message)
                            }
                        }}
                    >
                        {t('admin.orders.deleteSelected')}
                    </Button>
                </div>
            </div>

            <div className="flex items-center justify-between text-sm text-muted-foreground">
                <div>
                    {t('admin.orders.showing', { from: showingFrom, to: showingTo, total })}
                </div>
                <div className="flex items-center gap-2">
                    <Button asChild type="button" variant="outline" size="sm">
                        <a href={exportUrl({ type: 'orders', format: 'csv', q: query, status, fulfillment })}>
                            {t('admin.orders.exportCsv')}
                        </a>
                    </Button>
                    <Button asChild type="button" variant="outline" size="sm">
                        <a href={exportUrl({ type: 'orders', format: 'csv', includeSecrets: 1, q: query, status, fulfillment })}>
                            {t('admin.orders.exportCsvSecrets')}
                        </a>
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!queryValue.trim() && statusValue === 'all' && fulfillmentValue === 'all'}
                        onClick={() => {
                            setQueryValue("")
                            setStatusValue("all")
                            setFulfillmentValue("all")
                            router.push(buildUrl({ page: 1, pageSize }))
                        }}
                    >
                        {t('admin.orders.clearFilters')}
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!queryValue.trim() || queryValue.trim() === query}
                        onClick={() => applyFilters({ q: queryValue, page: 1 })}
                    >
                        {t('admin.orders.search')}
                    </Button>
                </div>
            </div>

            <div className="rounded-md border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[44px]">
                                <input
                                    type="checkbox"
                                    checked={allOnPageSelected}
                                    onChange={(e) => {
                                        const checked = e.target.checked
                                        const next: Record<string, boolean> = {}
                                        for (const o of orders) next[o.orderId] = checked
                                        setSelected(next)
                                    }}
                                    aria-label={t('admin.orders.selectAll')}
                                    className="h-4 w-4"
                                />
                            </TableHead>
                            <TableHead className="w-[120px]">{t('admin.orders.orderId')}</TableHead>
                            <TableHead className="min-w-[150px]">{t('admin.orders.user')}</TableHead>
                            <TableHead className="min-w-[120px]">{t('admin.orders.product')}</TableHead>
                            <TableHead className="w-[80px]">{t('admin.orders.amount')}</TableHead>
                            <TableHead className="w-[100px]">{t('admin.orders.status')}</TableHead>
                            <TableHead className="min-w-[120px]">{t('admin.orders.tradeNo')}</TableHead>
                            <TableHead className="min-w-[150px]">{t('admin.orders.cardKey')}</TableHead>
                            <TableHead className="min-w-[140px]">{t('admin.orders.date')}</TableHead>
                            <TableHead className="text-right w-[100px]">{t('admin.orders.actions')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {orders.map(order => (
                            <TableRow key={order.orderId}>
                                <TableCell>
                                    <input
                                        type="checkbox"
                                        checked={!!selected[order.orderId]}
                                        onChange={(e) => setSelected((prev) => ({ ...prev, [order.orderId]: e.target.checked }))}
                                        aria-label={t('admin.orders.selectOne')}
                                        className="h-4 w-4"
                                    />
                                </TableCell>
                                <TableCell className="font-mono text-xs">
                                    <Link href={`/admin/orders/${order.orderId}`} className="hover:underline">
                                        {order.orderId}
                                    </Link>
                                </TableCell>
                                <TableCell>
                                    {order.username ? (
                                        <div className="space-y-0.5">
                                            <a
                                                href={`https://linux.do/u/${order.username}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="font-medium text-sm hover:underline text-primary"
                                            >
                                                {order.username}
                                            </a>
                                            {order.email && (
                                                <div className="text-xs text-muted-foreground">
                                                    <CopyButton text={order.email} truncate maxLength={20} />
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <span className="font-medium text-sm text-muted-foreground">Guest</span>
                                    )}
                                </TableCell>
                                <TableCell>{order.productName}</TableCell>
                                <TableCell>{Number(order.amount)}</TableCell>
                                <TableCell>
                                    <Badge variant={getStatusBadgeVariant(order.status)} className="uppercase text-xs">
                                        {getStatusText(order.status)}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    {order.tradeNo ? (
                                        <CopyButton text={order.tradeNo} truncate maxLength={12} />
                                    ) : (
                                        <span className="text-muted-foreground">-</span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    {order.cardKey ? (
                                        <CopyButton text={order.cardKey} truncate maxLength={15} />
                                    ) : (
                                        <span className="text-muted-foreground">-</span>
                                    )}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-xs">
                                    <ClientDate value={order.createdAt} format="dateTime" />
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        <AdminOrderActions order={order} />
                                        <RefundButton order={order} />
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                    {t('admin.orders.page', { page, totalPages })}
                </div>
                <div className="flex items-center gap-2">
                    <div className="hidden md:flex items-center gap-1 text-sm text-muted-foreground mr-2">
                        <span>{t('admin.orders.pageSize')}:</span>
                        {[50, 100, 200].map((n) => (
                            <Button
                                key={n}
                                type="button"
                                variant={pageSize === n ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => applyAllFilters({ page: 1, pageSize: n })}
                            >
                                {n}
                            </Button>
                        ))}
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!canPrev}
                        onClick={() => applyAllFilters({ page: page - 1 })}
                    >
                        {t('admin.orders.prev')}
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!canNext}
                        onClick={() => applyAllFilters({ page: page + 1 })}
                    >
                        {t('admin.orders.next')}
                    </Button>
                </div>
            </div>
        </div>
    )
}
