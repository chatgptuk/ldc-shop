'use client'

import { useI18n } from "@/lib/i18n/context"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { BuyButton } from "@/components/buy-button"

interface Product {
    id: string
    name: string
    description: string | null
    price: string
    image: string | null
    category: string | null
}

interface BuyContentProps {
    product: Product
    stockCount: number
    isLoggedIn: boolean
}

export function BuyContent({ product, stockCount, isLoggedIn }: BuyContentProps) {
    const { t } = useI18n()

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
                                    {Number(product.price)} <span className="text-sm font-normal">{t('common.credits')}</span>
                                </div>
                                <Badge variant={stockCount > 0 ? "outline" : "destructive"} className="mt-1">
                                    {stockCount > 0 ? `${stockCount} ${t('common.inStock')}` : t('common.outOfStock')}
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
                            {product.description || t('buy.noDescription')}
                        </p>
                    </CardContent>
                    <Separator />
                    <CardFooter className="pt-6">
                        {isLoggedIn ? (
                            stockCount > 0 ? (
                                <BuyButton productId={product.id} />
                            ) : (
                                <p className="text-destructive">{t('buy.outOfStockMessage')}</p>
                            )
                        ) : (
                            <p className="text-muted-foreground">{t('buy.loginToBuy')}</p>
                        )}
                    </CardFooter>
                </Card>
            </div>
        </main>
    )
}
