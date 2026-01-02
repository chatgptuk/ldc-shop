'use client'

import { useI18n } from "@/lib/i18n/context"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Plus, Eye, EyeOff, ArrowUp, ArrowDown, TrendingUp, ShoppingCart, CreditCard, Package } from "lucide-react"
import { deleteProduct, toggleProductStatus, reorderProduct } from "@/actions/admin"
import { toast } from "sonner"

interface Product {
    id: string
    name: string
    price: string
    category: string | null
    stockCount: number
    isActive: boolean
    sortOrder: number
}

interface Stats {
    today: { count: number; revenue: number }
    week: { count: number; revenue: number }
    month: { count: number; revenue: number }
    total: { count: number; revenue: number }
}

interface AdminProductsContentProps {
    products: Product[]
    stats: Stats
}

export function AdminProductsContent({ products, stats }: AdminProductsContentProps) {
    const { t } = useI18n()

    const handleDelete = async (id: string) => {
        if (!confirm(t('admin.products.confirmDelete'))) return
        try {
            await deleteProduct(id)
            toast.success(t('common.success'))
        } catch (e: any) {
            toast.error(e.message)
        }
    }

    const handleToggle = async (id: string, currentStatus: boolean) => {
        try {
            await toggleProductStatus(id, !currentStatus)
            toast.success(t('common.success'))
        } catch (e: any) {
            toast.error(e.message)
        }
    }

    const handleReorder = async (id: string, direction: 'up' | 'down') => {
        const idx = products.findIndex(p => p.id === id)
        if (idx === -1) return

        // Swap with neighbor
        const targetIdx = direction === 'up' ? idx - 1 : idx + 1
        if (targetIdx < 0 || targetIdx >= products.length) return

        const current = products[idx]
        const target = products[targetIdx]

        try {
            // Use index as sortOrder to ensure unique values
            await reorderProduct(current.id, targetIdx)
            await reorderProduct(target.id, idx)
            toast.success(t('common.success'))
        } catch (e: any) {
            toast.error(e.message)
        }
    }

    return (
        <div className="space-y-6">
            {/* Dashboard Stats */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t('admin.stats.today')}</CardTitle>
                        <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.today.count}</div>
                        <p className="text-xs text-muted-foreground">{stats.today.revenue.toFixed(0)} {t('common.credits')}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t('admin.stats.week')}</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.week.count}</div>
                        <p className="text-xs text-muted-foreground">{stats.week.revenue.toFixed(0)} {t('common.credits')}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t('admin.stats.month')}</CardTitle>
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.month.count}</div>
                        <p className="text-xs text-muted-foreground">{stats.month.revenue.toFixed(0)} {t('common.credits')}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t('admin.stats.total')}</CardTitle>
                        <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.total.count}</div>
                        <p className="text-xs text-muted-foreground">{stats.total.revenue.toFixed(0)} {t('common.credits')}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Products Table */}
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">{t('admin.products.title')}</h1>
                <Link href="/admin/product/new">
                    <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        {t('admin.products.addNew')}
                    </Button>
                </Link>
            </div>

            <div className="rounded-md border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[50px]">{t('admin.products.order')}</TableHead>
                            <TableHead>{t('admin.products.name')}</TableHead>
                            <TableHead>{t('admin.products.price')}</TableHead>
                            <TableHead>{t('admin.products.category')}</TableHead>
                            <TableHead>{t('admin.products.stock')}</TableHead>
                            <TableHead>{t('admin.products.status')}</TableHead>
                            <TableHead className="text-right">{t('admin.products.actions')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {products.map((product, idx) => (
                            <TableRow key={product.id} className={!product.isActive ? 'opacity-50' : ''}>
                                <TableCell>
                                    <div className="flex flex-col gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            onClick={() => handleReorder(product.id, 'up')}
                                            disabled={idx === 0}
                                        >
                                            <ArrowUp className="h-3 w-3" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            onClick={() => handleReorder(product.id, 'down')}
                                            disabled={idx === products.length - 1}
                                        >
                                            <ArrowDown className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </TableCell>
                                <TableCell className="font-medium">{product.name}</TableCell>
                                <TableCell>{Number(product.price)}</TableCell>
                                <TableCell className="capitalize">{product.category || 'general'}</TableCell>
                                <TableCell>{product.stockCount}</TableCell>
                                <TableCell>
                                    <Badge variant={product.isActive ? 'default' : 'secondary'}>
                                        {product.isActive ? t('admin.products.active') : t('admin.products.inactive')}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right space-x-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleToggle(product.id, product.isActive)}
                                        title={product.isActive ? t('admin.products.hide') : t('admin.products.show')}
                                    >
                                        {product.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </Button>
                                    <Link href={`/admin/cards/${product.id}`}>
                                        <Button variant="outline" size="sm">{t('admin.products.manageCards')}</Button>
                                    </Link>
                                    <Link href={`/admin/product/edit/${product.id}`}>
                                        <Button variant="outline" size="sm">{t('common.edit')}</Button>
                                    </Link>
                                    <Button variant="destructive" size="sm" onClick={() => handleDelete(product.id)}>
                                        {t('common.delete')}
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}

