import { notFound } from "next/navigation"
import { db } from "@/lib/db"
import { products, cards } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { BuyContent } from "@/components/buy-content"

export const dynamic = 'force-dynamic'

interface BuyPageProps {
    params: Promise<{ id: string }>
}

export default async function BuyPage({ params }: BuyPageProps) {
    const { id } = await params
    const session = await auth()

    // Get product
    const result = await db
        .select({
            id: products.id,
            name: products.name,
            description: products.description,
            price: products.price,
            image: products.image,
            category: products.category,
        })
        .from(products)
        .where(eq(products.id, id))
        .limit(1)

    const product = result[0]

    if (!product) {
        notFound()
    }

    // Get stock count
    const stockResult = await db
        .select()
        .from(cards)
        .where(and(eq(cards.productId, id), eq(cards.isUsed, false)))

    const stockCount = stockResult.length

    return (
        <BuyContent
            product={product}
            stockCount={stockCount}
            isLoggedIn={!!session?.user}
        />
    )
}
