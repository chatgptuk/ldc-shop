import { db } from "@/lib/db"
import { cards } from "@/lib/db/schema"
import { eq, desc, and } from "drizzle-orm"
import { getProduct } from "@/lib/db/queries"
import { notFound } from "next/navigation"
import { CardsContent } from "@/components/admin/cards-content"

export default async function CardsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const product = await getProduct(id)
    if (!product) return notFound()

    // Get Unused Cards
    const unusedCards = await db.select()
        .from(cards)
        .where(and(eq(cards.productId, id), eq(cards.isUsed, false)))
        .orderBy(desc(cards.createdAt))

    return (
        <CardsContent
            productId={id}
            productName={product.name}
            unusedCards={unusedCards.map(c => ({ id: c.id, cardKey: c.cardKey }))}
        />
    )
}
