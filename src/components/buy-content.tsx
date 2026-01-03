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
        <main className="container py-8 md:py-16">
            <div className="mx-auto max-w-3xl">
                <Card className="tech-card overflow-hidden">
                    <CardHeader className="relative pb-0">
                        {/* Background glow effect */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10" />

                        <div className="flex items-start justify-between gap-4">
                            <div className="space-y-2">
                                <CardTitle className="text-2xl md:text-3xl font-bold">{product.name}</CardTitle>
                                {product.category && product.category !== 'general' && (
                                    <Badge variant="secondary" className="capitalize backdrop-blur-sm">
                                        {product.category}
                                    </Badge>
                                )}
                            </div>
                            <div className="text-right shrink-0">
                                <div className="text-4xl font-bold gradient-text">
                                    {Number(product.price)}
                                </div>
                                <span className="text-sm text-muted-foreground">{t('common.credits')}</span>
                                <div className="mt-2">
                                    <Badge
                                        variant={stockCount > 0 ? "outline" : "destructive"}
                                        className={stockCount > 0 ? "border-primary/30 text-primary" : ""}
                                    >
                                        {stockCount > 0 ? `${t('common.stock')}: ${stockCount}` : t('common.outOfStock')}
                                    </Badge>
                                </div>
                            </div>
                        </div>
                    </CardHeader>

                    <Separator className="my-6 bg-border/50" />

                    <CardContent className="space-y-6">
                        {/* Product Image */}
                        <div className="aspect-video relative bg-gradient-to-br from-muted/20 to-muted/5 rounded-xl overflow-hidden flex items-center justify-center border border-border/30">
                            <img
                                src={product.image || `https://api.dicebear.com/7.x/shapes/svg?seed=${product.id}`}
                                alt={product.name}
                                className="max-w-full max-h-full object-contain"
                            />
                            {/* Corner accents */}
                            <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-primary/30 rounded-tl-xl" />
                            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-primary/30 rounded-br-xl" />
                        </div>

                        {/* Description */}
                        <div className="space-y-2">
                            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                                {t('buy.description') || 'Description'}
                            </h3>
                            <p className="text-foreground/80 leading-relaxed whitespace-pre-wrap break-words">
                                {product.description || t('buy.noDescription')}
                            </p>
                        </div>
                    </CardContent>

                    <Separator className="bg-border/50" />

                    <CardFooter className="pt-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                        {isLoggedIn ? (
                            stockCount > 0 ? (
                                <div className="w-full sm:w-auto">
                                    <BuyButton productId={product.id} />
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-destructive">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    <p className="font-medium">{t('buy.outOfStockMessage')}</p>
                                </div>
                            )
                        ) : (
                            <div className="flex items-center gap-2 text-muted-foreground bg-muted/30 px-4 py-3 rounded-lg w-full sm:w-auto">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                <p>{t('buy.loginToBuy')}</p>
                            </div>
                        )}
                    </CardFooter>
                </Card>
            </div>
        </main>
    )
}
