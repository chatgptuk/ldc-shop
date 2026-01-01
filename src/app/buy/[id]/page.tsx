import { notFound } from "next/navigation"
import { db } from "@/lib/db"
import { products, cards } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { BuyButton } from "@/components/buy-button"
import { auth } from "@/lib/auth"

export const dynamic = 'force-dynamic'

interface BuyPageProps {
    params: Promise<{ id: string }>
}

export default async function BuyPage({ params }: BuyPageProps) {
    const { id } = await params
    const session = await auth()

    // Get product with stock count
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
        <main className="container py-8 md:py-12">
            <div className="mx-auto max-w-3xl">
                <Card>
                    <CardHeader>
                        <div className="flex items-start justify-between">
                            <div>
                                <CardTitle className="text-2xl">{product.name}</CardTitle>
                                {product.category && product.category !== 'general' && (
                                    <Badge variant="secondary" className="mt-2 capitalize">
                                        {product.category}
                                    </Badge>
                                )}
                            </div>
                            <div className="text-right">
                                <div className="text-3xl font-bold text-primary">
                                    {Number(product.price)} <span className="text-sm font-normal">Credits</span>
                                </div>
                                <Badge variant={stockCount > 0 ? "outline" : "destructive"} className="mt-1">
                                    {stockCount > 0 ? `${stockCount} in stock` : 'Out of Stock'}
                                </Badge>
                            </div>
                        </div>
                    </CardHeader>
                    <Separator />
                    <CardContent className="pt-6">
                        <div className="aspect-video relative bg-muted/20 rounded-lg overflow-hidden mb-6 flex items-center justify-center">
                            <img
                                src={product.image || `https://api.dicebear.com/7.x/shapes/svg?seed=${product.id}`}
                                alt={product.name}
                                className="max-w-full max-h-full object-contain"
                            />
                        </div>
                        <p className="text-muted-foreground leading-relaxed">
                            {product.description || "No description available."}
                        </p>
                    </CardContent>
                    <Separator />
                    <CardFooter className="pt-6">
                        {session?.user ? (
                            stockCount > 0 ? (
                                <BuyButton productId={product.id} productName={product.name} price={Number(product.price)} />
                            ) : (
                                <p className="text-destructive">This product is currently out of stock.</p>
                            )
                        ) : (
                            <p className="text-muted-foreground">Please sign in to purchase this product.</p>
                        )}
                    </CardFooter>
                </Card>
            </div>
        </main>
    )
}
