import { db } from "@/lib/db"
import { getProducts, getDashboardStats } from "@/lib/db/queries"
import { AdminProductsContent } from "@/components/admin/products-content"

export default async function AdminPage() {
    const [products, stats] = await Promise.all([
        getProducts(),
        getDashboardStats()
    ])

    return (
        <AdminProductsContent
            products={products.map(p => ({
                id: p.id,
                name: p.name,
                price: p.price,
                category: p.category,
                stockCount: p.stock,
                isActive: p.isActive ?? true,
                sortOrder: p.sortOrder ?? 0
            }))}
            stats={stats}
        />
    )
}

