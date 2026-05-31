'use client'

import { useEffect, useMemo, useState } from "react"
import { useI18n } from "@/lib/i18n/context"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { BuyButton } from "@/components/buy-button"
import { StarRating } from "@/components/star-rating"
import { ReviewForm } from "@/components/review-form"
import { ReviewList } from "@/components/review-list"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "@/components/ui/dialog"
import ReactMarkdown from 'react-markdown'
import { Share2 } from "lucide-react"
import { toast } from "sonner"

interface Product {
    id: string
    name: string
    description: string | null
    price: string
    compareAtPrice?: string | null
    maxPointsDiscount?: string | null
    image: string | null
    category: string | null
    purchaseLimit?: number | null
    isHot?: boolean | null
}

interface Review {
    id: number
    username: string
    rating: number
    comment: string | null
    createdAt: Date | string
}

interface BuyContentProps {
    product: Product
    stockCount: number
    lockedStockCount?: number
    isLoggedIn: boolean
    reviews?: Review[]
    averageRating?: number
    reviewCount?: number
    canReview?: boolean
    reviewOrderId?: string
}

export function BuyContent({
    product,
    stockCount,
    lockedStockCount = 0,
    isLoggedIn,
    reviews = [],
    averageRating = 0,
    reviewCount = 0,
    canReview = false,
    reviewOrderId
}: BuyContentProps) {
    const { t } = useI18n()
    const [shareUrl, setShareUrl] = useState('')
    const [quantity, setQuantity] = useState(1)

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setShareUrl(window.location.href)
        }
    }, [product.id])

    const shareLinks = useMemo(() => {
        if (!shareUrl) return null
        const encodedUrl = encodeURIComponent(shareUrl)
        const shareText = product.name
        const encodedText = encodeURIComponent(shareText)
        return {
            x: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
            facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
            telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
            whatsapp: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`,
            line: `https://social-plugins.line.me/lineit/share?url=${encodedUrl}`
        }
    }, [shareUrl, product.name])

    const handleCopyLink = async () => {
        if (!shareUrl) return
        if (navigator.clipboard?.writeText) {
            try {
                await navigator.clipboard.writeText(shareUrl)
                toast.success(t('buy.shareCopied'))
            } catch {
                toast.error(t('buy.shareFailed'))
            }
            return
        }
        toast.error(t('buy.shareFailed'))
    }

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
                                {product.isHot && (
                                    <Badge variant="default" className="w-fit bg-primary/15 text-primary border border-primary/30">
                                        {t('buy.hot')}
                                    </Badge>
                                )}
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
                                {product.compareAtPrice && Number(product.compareAtPrice) > Number(product.price) && (
                                    <div className="text-sm text-muted-foreground line-through">
                                        {Number(product.compareAtPrice)}
                                    </div>
                                )}
                                <span className="text-sm text-muted-foreground">{t('common.credits')}</span>
                                <div className="mt-2">
                                    <Badge
                                        variant={stockCount > 0 ? "outline" : "destructive"}
                                        className={stockCount > 0 ? "border-primary/30 text-primary" : ""}
                                    >
                                        {stockCount > 0 ? `${t('common.stock')}: ${stockCount}` : t('common.outOfStock')}
                                    </Badge>
                                    {typeof product.purchaseLimit === 'number' && product.purchaseLimit > 0 && (
                                        <Badge variant="secondary" className="mt-2">
                                            {t('buy.purchaseLimit', { limit: product.purchaseLimit })}
                                        </Badge>
                                    )}
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
                        <div className="space-y-4">
                            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                                {t('buy.description') || 'Description'}
                            </h3>
                            <div className="prose prose-sm dark:prose-invert max-w-none text-foreground/80 leading-relaxed break-words">
                                <ReactMarkdown>
                                    {product.description || t('buy.noDescription')}
                                </ReactMarkdown>
                            </div>
                        </div>
                    </CardContent>

                    <Separator className="bg-border/50" />

                    <CardFooter className="pt-6 flex flex-col gap-3">
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                            <div className="flex-1">
                                {isLoggedIn ? (
                                    stockCount > 0 ? (
                                        <div className="flex flex-col gap-4 w-full sm:w-auto">
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center border border-border rounded-md">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 rounded-none border-r border-border"
                                                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                                        disabled={quantity <= 1}
                                                    >
                                                        -
                                                    </Button>
                                                    <Input
                                                        type="text"
                                                        value={quantity}
                                                        onChange={(e) => {
                                                            const val = e.target.value
                                                            if (val === '') {
                                                                setQuantity(1)
                                                                return
                                                            }
                                                            const num = parseInt(val)
                                                            if (!isNaN(num)) {
                                                                setQuantity(num)
                                                            }
                                                        }}
                                                        onBlur={(e) => {
                                                            let val = parseInt(e.target.value)
                                                            if (isNaN(val) || val < 1) val = 1

                                                            const limit = product.purchaseLimit && product.purchaseLimit > 0 ? product.purchaseLimit : 999
                                                            const max = Math.min(stockCount, limit)

                                                            if (val > max) {
                                                                val = max
                                                                toast.error(t('buy.limitExceeded'))
                                                            }

                                                            setQuantity(val)
                                                        }}
                                                        className="w-16 h-8 rounded-none border-x-0 text-center px-1 focus-visible:ring-0 focus-visible:border-primary"
                                                    />
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 rounded-none border-l border-border"
                                                        onClick={() => {
                                                            const limit = product.purchaseLimit && product.purchaseLimit > 0 ? product.purchaseLimit : 999
                                                            const max = Math.min(stockCount, limit)
                                                            setQuantity(Math.min(max, quantity + 1))
                                                        }}
                                                        disabled={quantity >= Math.min(stockCount, (product.purchaseLimit && product.purchaseLimit > 0 ? product.purchaseLimit : 999))}
                                                    >
                                                        +
                                                    </Button>
                                                </div>
                                                <div className="text-sm font-medium text-muted-foreground">
                                                    {t('buy.modal.total')}: <span className="text-primary font-bold">{(Number(product.price) * quantity).toFixed(2)}</span>
                                                </div>
                                            </div>
                                            <BuyButton
                                                productId={product.id}
                                                price={product.price}
                                                productName={product.name}
                                                quantity={quantity}
                                                maxPointsDiscount={product.maxPointsDiscount}
                                            />
                                        </div>
                                    ) : (
                                        lockedStockCount > 0 ? (
                                            <div className="flex items-center gap-2 text-warning">
                                                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                <p className="font-medium text-sm text-yellow-600 dark:text-yellow-500">
                                                    {t('buy.stockLockedMessage')}
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 text-destructive">
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                </svg>
                                                <p className="font-medium">{t('buy.outOfStockMessage')}</p>
                                            </div>
                                        )
                                    )
                                ) : (
                                    <div className="flex items-center gap-2 text-muted-foreground bg-muted/30 px-4 py-3 rounded-lg w-full sm:w-auto">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                        <p>{t('buy.loginToBuy')}</p>
                                    </div>
                                )}
                            </div>
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="w-full sm:w-auto"
                                    >
                                        <Share2 className="mr-2 h-4 w-4" />
                                        {t('buy.share')}
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>{t('buy.shareTitle')}</DialogTitle>
                                        <DialogDescription>{t('buy.shareDescription')}</DialogDescription>
                                    </DialogHeader>
                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                        {shareLinks?.x ? (
                                            <Button asChild variant="outline">
                                                <a href={shareLinks.x} target="_blank" rel="noopener noreferrer">X (Twitter)</a>
                                            </Button>
                                        ) : (
                                            <Button variant="outline" disabled>X (Twitter)</Button>
                                        )}
                                        {shareLinks?.facebook ? (
                                            <Button asChild variant="outline">
                                                <a href={shareLinks.facebook} target="_blank" rel="noopener noreferrer">Facebook</a>
                                            </Button>
                                        ) : (
                                            <Button variant="outline" disabled>Facebook</Button>
                                        )}
                                        {shareLinks?.telegram ? (
                                            <Button asChild variant="outline">
                                                <a href={shareLinks.telegram} target="_blank" rel="noopener noreferrer">Telegram</a>
                                            </Button>
                                        ) : (
                                            <Button variant="outline" disabled>Telegram</Button>
                                        )}
                                        {shareLinks?.whatsapp ? (
                                            <Button asChild variant="outline">
                                                <a href={shareLinks.whatsapp} target="_blank" rel="noopener noreferrer">WhatsApp</a>
                                            </Button>
                                        ) : (
                                            <Button variant="outline" disabled>WhatsApp</Button>
                                        )}
                                        {shareLinks?.line ? (
                                            <Button asChild variant="outline">
                                                <a href={shareLinks.line} target="_blank" rel="noopener noreferrer">Line</a>
                                            </Button>
                                        ) : (
                                            <Button variant="outline" disabled>Line</Button>
                                        )}
                                    </div>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        onClick={handleCopyLink}
                                        disabled={!shareUrl}
                                    >
                                        {t('buy.shareCopy')}
                                    </Button>
                                </DialogContent>
                            </Dialog>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {t('buy.paymentTimeoutNotice')}
                        </p>
                    </CardFooter>
                </Card>

                {/* Reviews Section */}
                <Card className="tech-card mt-8">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-3">
                                {t('review.title')}
                                {reviewCount > 0 && (
                                    <div className="flex items-center gap-2">
                                        <StarRating rating={Math.round(averageRating)} size="sm" />
                                        <span className="text-sm font-normal text-muted-foreground">
                                            ({averageRating.toFixed(1)})
                                        </span>
                                    </div>
                                )}
                            </CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {canReview && reviewOrderId && (
                            <div className="p-4 border rounded-lg bg-muted/20">
                                <h3 className="text-sm font-medium mb-3">{t('review.leaveReview')}</h3>
                                <ReviewForm productId={product.id} orderId={reviewOrderId} />
                            </div>
                        )}
                        <ReviewList
                            reviews={reviews}
                            averageRating={averageRating}
                            totalCount={reviewCount}
                        />
                    </CardContent>
                </Card>
            </div>
        </main>
    )
}
