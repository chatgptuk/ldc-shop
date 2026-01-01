'use client'

import { useI18n } from "@/lib/i18n/context"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus } from "lucide-react"
import { deleteProduct } from "@/actions/admin"
import { toast } from "sonner"

interface Product {
    id: string
    name: string
    price: string
    category: string | null
    stockCount: number
}

export function AdminProductsContent({ products }: { products: Product[] }) {
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

    return (
        <div className="space-y-6">
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
                            <TableHead>{t('admin.products.name')}</TableHead>
                            <TableHead>{t('admin.products.price')}</TableHead>
                            <TableHead>{t('admin.products.category')}</TableHead>
                            <TableHead>{t('admin.products.stock')}</TableHead>
                            <TableHead className="text-right">{t('admin.products.actions')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {products.map(product => (
                            <TableRow key={product.id}>
                                <TableCell className="font-medium">{product.name}</TableCell>
                                <TableCell>{Number(product.price)}</TableCell>
                                <TableCell className="capitalize">{product.category || 'general'}</TableCell>
                                <TableCell>{product.stockCount}</TableCell>
                                <TableCell className="text-right space-x-2">
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
