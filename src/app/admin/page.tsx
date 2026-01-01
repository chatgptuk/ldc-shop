import { db } from "@/lib/db"
import { getProducts } from "@/lib/db/queries"
import { AdminProductsContent } from "@/components/admin/products-content"

export default async function AdminPage() {
    const products = await getProducts()

    return (
        <AdminProductsContent
            products={products.map(p => ({
                id: p.id,
                name: p.name,
                price: p.price,
                category: p.category,
                stockCount: p.stock
            }))}
        />
    )
}
