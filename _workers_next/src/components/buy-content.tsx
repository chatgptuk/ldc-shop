'use client'

import { useEffect, useMemo, useState } from "react"
import { useI18n } from "@/lib/i18n/context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
import { ChevronLeft, ChevronRight, Expand, Loader2, Minus, Plus, Share2 } from "lucide-react"
import { ProductImagePlaceholder } from "@/components/product-image-placeholder"
import { toast } from "sonner"
import Image from "next/image"
import { INFINITE_STOCK } from "@/lib/constants"
import { getBuyPageMeta } from "@/actions/buy"
import type { ProductVariantRow } from "@/lib/db/queries"
import { buildProductImageGallery } from "@/lib/product-images"

interface Product {
    id: string
    name: string
    description: string | null
    price: string
    compareAtPrice?: string | null
    maxPointsDiscount?: string | null
    image: string | null
    productImages?: string | null
    category: string | null
    purchaseLimit?: number | null
    purchaseWarning?: string | null
    purchaseQuestions?: string | null
    isHot?: boolean | null
    sold?: number
}

interface Review {
    id: number
    username: string
    userId?: string | null
    rating: number
    comment: string | null
    createdAt: Date | string | null
    replies?: Array<{
        id: number
        username: string
        userId?: string | null
        comment: string
        createdAt: Date | string | null
    }>
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
    emailConfigured?: boolean
    variants?: (ProductVariantRow & { stockCount: number; lockedCount: number })[]
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
    reviewOrderId,
    emailConfigured = false,
    variants = []
}: BuyContentProps) {
    const { t } = useI18n()
    const [selectedVariantId, setSelectedVariantId] = useState<string>(product.id)
    const [selectedGalleryImage, setSelectedGalleryImage] = useState<string | null>(null)
    const [isGalleryDialogOpen, setIsGalleryDialogOpen] = useState(false)
    const [shareUrl, setShareUrl] = useState('')
    const [quantity, setQuantity] = useState(1)
    const [showWarningDialog, setShowWarningDialog] = useState(false)
    const [warningConfirmed, setWarningConfirmed] = useState(false)
    const [reviewsState, setReviewsState] = useState<Review[]>(reviews)
    const [averageRatingState, setAverageRatingState] = useState(averageRating)
    const [reviewCountState, setReviewCountState] = useState(reviewCount)
    const [canReviewState, setCanReviewState] = useState(canReview)
    const [reviewOrderIdState, setReviewOrderIdState] = useState<string | undefined>(reviewOrderId)
    const [emailConfiguredState, setEmailConfiguredState] = useState(emailConfigured)
    const [metaLoading, setMetaLoading] = useState(true)
    const [metaRefreshSeq, setMetaRefreshSeq] = useState(0)

    const [questionAnswers, setQuestionAnswers] = useState<string[]>([])
    const [questionsVerified, setQuestionsVerified] = useState(false)
    const [questionError, setQuestionError] = useState(false)

    const displayProduct = useMemo(() => {
        if (variants.length > 1 && selectedVariantId) {
            const v = variants.find((x) => x.id === selectedVariantId)
            if (v) {
                return {
                    id: v.id,
                    name: v.name,
                    description: v.description,
                    price: v.price,
                    compareAtPrice: v.compareAtPrice,
                    maxPointsDiscount: v.maxPointsDiscount,
                    image: v.image,
                    productImages: v.productImages,
                    category: product.category,
                    purchaseLimit: v.purchaseLimit,
                    purchaseWarning: v.purchaseWarning ?? null,
                    purchaseQuestions: v.purchaseQuestions ?? null,
                    isHot: v.isHot ?? false,
                } satisfies Product
            }
        }
        return product
    }, [product, variants, selectedVariantId])

    const displayStock = useMemo(() => {
        if (variants.length > 1 && selectedVariantId) {
            const v = variants.find((x) => x.id === selectedVariantId)
            if (v) return v.stockCount
        }
        return stockCount
    }, [stockCount, variants, selectedVariantId])

    const displayLocked = useMemo(() => {
        if (variants.length > 1 && selectedVariantId) {
            const v = variants.find((x) => x.id === selectedVariantId)
            if (v) return v.lockedCount
        }
        return lockedStockCount
    }, [lockedStockCount, variants, selectedVariantId])

    const displaySold = useMemo(() => {
        if (variants.length > 1 && selectedVariantId) {
            const v = variants.find((x) => x.id === selectedVariantId)
            if (v && typeof v.sold === 'number') {
                return v.sold
            }
        }
        if (typeof product.sold === 'number') {
            return product.sold
        }
        return 0
    }, [product, variants, selectedVariantId])

    const questions = useMemo<Array<{ q: string; a: string }>>(() => {
        try {
            const raw = displayProduct.purchaseQuestions
            if (raw) {
                const parsed = JSON.parse(raw)
                if (Array.isArray(parsed) && parsed.length > 0) return parsed
            }
        } catch { /* ignore */ }
        return []
    }, [displayProduct.purchaseQuestions])

    const galleryImages = useMemo(
        () => buildProductImageGallery(displayProduct.image, displayProduct.productImages ?? null),
        [displayProduct.image, displayProduct.productImages]
    )

    useEffect(() => {
        setQuestionAnswers(questions.map(() => ''))
        setQuestionsVerified(false)
        setQuestionError(false)
    }, [questions])

    const handleVerifyAnswers = () => {
        const allCorrect = questions.every((q, i) => {
            const userAnswer = (questionAnswers[i] || '').trim().toLowerCase()
            const correctAnswer = q.a.trim().toLowerCase()
            return userAnswer === correctAnswer
        })
        if (allCorrect) {
            setQuestionsVerified(true)
            setQuestionError(false)
        } else {
            setQuestionError(true)
        }
    }

    const hasQuestions = questions.length > 0
    const needsQuestionVerification = hasQuestions && !questionsVerified

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setShareUrl(window.location.href)
        }
    }, [product.id])

    useEffect(() => {
        setSelectedVariantId(product.id)
    }, [product.id])

    useEffect(() => {
        setSelectedGalleryImage(galleryImages[0] ?? null)
    }, [displayProduct.id, displayProduct.image, displayProduct.productImages])

    useEffect(() => {
        let cancelled = false

        const loadMeta = async () => {
            setMetaLoading(true)
            try {
                const meta = await getBuyPageMeta(displayProduct.id)
                if (cancelled) return

                setReviewsState(meta.reviews)
                setAverageRatingState(meta.averageRating)
                setReviewCountState(meta.reviewCount)
                setCanReviewState(meta.canReview)
                setReviewOrderIdState(meta.reviewOrderId)
                setEmailConfiguredState(meta.emailConfigured)
            } catch {
                // Keep initial values when lazy fetch fails.
            } finally {
                if (!cancelled) {
                    setMetaLoading(false)
                }
            }
        }

        void loadMeta()
        return () => {
            cancelled = true
        }
    }, [displayProduct.id, metaRefreshSeq])

    const shareLinks = useMemo(() => {
        if (!shareUrl) return null
        const encodedUrl = encodeURIComponent(shareUrl)
        const shareText = displayProduct.name
        const encodedText = encodeURIComponent(shareText)
        return {
            x: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
            facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
            telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
            whatsapp: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`,
            line: `https://social-plugins.line.me/lineit/share?url=${encodedUrl}`
        }
    }, [shareUrl, displayProduct.name])

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

    const hasUnlimitedStock = displayStock >= INFINITE_STOCK
    const hasStock = displayStock > 0 || hasUnlimitedStock
    const maxStock = hasUnlimitedStock ? INFINITE_STOCK : (displayStock - displayLocked)
    const maxSelectableQuantity = displayProduct.purchaseLimit && displayProduct.purchaseLimit > 0
        ? Math.min(maxStock, displayProduct.purchaseLimit)
        : maxStock
    const priceValue = Number(displayProduct.price)
    const compareAtPriceValue = displayProduct.compareAtPrice ? Number(displayProduct.compareAtPrice) : null
    const stockLabel = hasUnlimitedStock
        ? `${t('common.stock')}: ${t('common.unlimited')}`
        : (displayStock > 0 ? `${t('common.stock')}: ${displayStock}` : t('common.outOfStock'))
    const showReviewSummary = !metaLoading && reviewCountState > 0
    const activeGalleryImage = selectedGalleryImage && galleryImages.includes(selectedGalleryImage)
        ? selectedGalleryImage
        : galleryImages[0] ?? null
    const activeGalleryIndex = activeGalleryImage ? galleryImages.indexOf(activeGalleryImage) : -1
    const canSwitchGallery = galleryImages.length > 1 && activeGalleryIndex >= 0

    const showPreviousGalleryImage = () => {
        if (!canSwitchGallery) return
        const nextIndex = activeGalleryIndex === 0 ? galleryImages.length - 1 : activeGalleryIndex - 1
        setSelectedGalleryImage(galleryImages[nextIndex] ?? null)
    }

    const showNextGalleryImage = () => {
        if (!canSwitchGallery) return
        const nextIndex = activeGalleryIndex === galleryImages.length - 1 ? 0 : activeGalleryIndex + 1
        setSelectedGalleryImage(galleryImages[nextIndex] ?? null)
    }

    const showInlineShareAction = isLoggedIn && hasStock && !needsQuestionVerification

    const renderShareButton = (inline = false) => (
        <Dialog>
            <DialogTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    className={
                        inline
                            ? "h-11 w-11 shrink-0 rounded-full border-border/45 bg-background/62 p-0 text-muted-foreground transition-colors hover:border-border hover:bg-muted/45 hover:text-foreground"
                            : "h-10 w-10 rounded-full border-border/40 bg-background/58 p-0 text-muted-foreground transition-colors hover:border-border hover:bg-muted/45 hover:text-foreground"
                    }
                    aria-label={t('buy.share')}
                    title={t('buy.share')}
                >
                    <Share2 className={inline ? "h-4 w-4 opacity-75" : "h-4 w-4 opacity-70"} />
                </Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{t('buy.shareTitle')}</DialogTitle>
                    <DialogDescription>{t('buy.shareDescription')}</DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-2">
                    {shareLinks?.x ? (
                        <Button asChild variant="outline" className="rounded-xl">
                            <a href={shareLinks.x} target="_blank" rel="noopener noreferrer">X (Twitter)</a>
                        </Button>
                    ) : (
                        <Button variant="outline" className="rounded-xl" disabled>X (Twitter)</Button>
                    )}
                    {shareLinks?.facebook ? (
                        <Button asChild variant="outline" className="rounded-xl">
                            <a href={shareLinks.facebook} target="_blank" rel="noopener noreferrer">Facebook</a>
                        </Button>
                    ) : (
                        <Button variant="outline" className="rounded-xl" disabled>Facebook</Button>
                    )}
                    {shareLinks?.telegram ? (
                        <Button asChild variant="outline" className="rounded-xl">
                            <a href={shareLinks.telegram} target="_blank" rel="noopener noreferrer">Telegram</a>
                        </Button>
                    ) : (
                        <Button variant="outline" className="rounded-xl" disabled>Telegram</Button>
                    )}
                    {shareLinks?.whatsapp ? (
                        <Button asChild variant="outline" className="rounded-xl">
                            <a href={shareLinks.whatsapp} target="_blank" rel="noopener noreferrer">WhatsApp</a>
                        </Button>
                    ) : (
                        <Button variant="outline" className="rounded-xl" disabled>WhatsApp</Button>
                    )}
                    {shareLinks?.line ? (
                        <Button asChild variant="outline" className="rounded-xl col-span-2">
                            <a href={shareLinks.line} target="_blank" rel="noopener noreferrer">Line</a>
                        </Button>
                    ) : (
                        <Button variant="outline" className="rounded-xl col-span-2" disabled>Line</Button>
                    )}
                </div>
                <Button
                    type="button"
                    variant="secondary"
                    className="rounded-xl"
                    onClick={handleCopyLink}
                    disabled={!shareUrl}
                >
                    {t('buy.shareCopy')}
                </Button>
            </DialogContent>
        </Dialog>
    )

    return (
        <main className="container relative py-8 md:py-16">
            <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
                <div className="absolute left-1/2 top-[-16rem] h-[28rem] w-[70rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,_rgba(59,130,246,0.12),_transparent_62%)] blur-3xl dark:bg-[radial-gradient(circle,_rgba(96,165,250,0.18),_transparent_65%)]" />
                <div className="absolute left-[10%] top-20 h-48 w-72 rounded-full bg-primary/10 blur-3xl" />
                <div className="absolute right-[5%] top-24 h-64 w-64 rounded-full bg-cyan-200/16 blur-3xl dark:bg-cyan-400/10" />
                <div className="absolute inset-0 opacity-[0.025] [background-image:linear-gradient(to_right,rgba(15,23,42,0.15)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.1)_1px,transparent_1px)] [background-size:72px_72px] dark:[background-image:linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)]" />
            </div>

            <div className="mx-auto max-w-6xl space-y-8 md:space-y-10">
                <section className="grid gap-8 lg:grid-cols-[minmax(0,1.06fr)_24rem] xl:grid-cols-[minmax(0,1.06fr)_27rem]">
                    <div className="space-y-6">
                        <div className="relative overflow-hidden rounded-[2rem] border border-border/40 bg-gradient-to-br from-card via-card/96 to-primary/5 shadow-[0_30px_90px_-48px_rgba(15,23,42,0.32)]">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.78),_transparent_32%)] dark:bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.08),_transparent_36%)]" />
                            <div className="relative space-y-6 p-5 md:space-y-8 md:p-6 lg:p-8">
                                <div className="relative overflow-hidden rounded-[1.8rem] border border-border/20 bg-card/48 p-3 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.35)] md:p-4">
                                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.25),_transparent_48%)] dark:bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),_transparent_52%)]" />
                                    <div className="relative flex aspect-[16/10] w-full items-center justify-center overflow-hidden rounded-[1.45rem] bg-card/72">
                                        {activeGalleryImage ? (
                                            <button
                                                type="button"
                                                className="group relative h-full w-full cursor-zoom-in text-left"
                                                onClick={() => setIsGalleryDialogOpen(true)}
                                                aria-label={t('buy.viewLargeImage')}
                                                title={t('buy.viewLargeImage')}
                                            >
                                                <Image
                                                    src={activeGalleryImage}
                                                    alt={displayProduct.name}
                                                    fill
                                                    sizes="(max-width: 1024px) 100vw, 60vw"
                                                    className="object-contain"
                                                    draggable={false}
                                                />
                                                <div className="absolute bottom-3 right-3 inline-flex h-7 w-7 items-center justify-center rounded-full border border-border/15 bg-background/56 text-muted-foreground/70 shadow-sm backdrop-blur-sm transition-colors group-hover:text-foreground/75">
                                                    <Expand className="h-3.5 w-3.5" />
                                                </div>
                                            </button>
                                        ) : (
                                            <div className="flex h-full items-center justify-center">
                                                <ProductImagePlaceholder productId={displayProduct.id} productName={displayProduct.name} size="md" fill />
                                            </div>
                                        )}
                                        {canSwitchGallery && (
                                            <>
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    size="icon"
                                                    className="absolute left-3 top-1/2 h-10 w-10 -translate-y-1/2 rounded-full border border-border/35 bg-background/85 shadow-lg backdrop-blur hover:bg-background"
                                                    onClick={showPreviousGalleryImage}
                                                    aria-label="Previous image"
                                                >
                                                    <ChevronLeft className="h-5 w-5" />
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    size="icon"
                                                    className="absolute right-3 top-1/2 h-10 w-10 -translate-y-1/2 rounded-full border border-border/35 bg-background/85 shadow-lg backdrop-blur hover:bg-background"
                                                    onClick={showNextGalleryImage}
                                                    aria-label="Next image"
                                                >
                                                    <ChevronRight className="h-5 w-5" />
                                                </Button>
                                                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-border/25 bg-background/78 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
                                                    {activeGalleryIndex + 1} / {galleryImages.length}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-5">
                                    <div className="flex flex-wrap items-center gap-2">
                                        {displayProduct.category && displayProduct.category !== 'general' && (
                                            <Badge variant="secondary" className="rounded-full border border-border/45 bg-background/70 px-3 py-1 capitalize">
                                                {displayProduct.category}
                                            </Badge>
                                        )}
                                        {displayProduct.isHot && (
                                            <Badge className="rounded-full border-0 bg-orange-500 px-3 py-1 text-white shadow-lg shadow-orange-500/20">
                                                {t('buy.hot')}
                                            </Badge>
                                        )}
                                    </div>

                                    <div className="rounded-[1.4rem] border border-border/15 bg-background/52 px-5 py-4 shadow-[0_16px_40px_-42px_rgba(15,23,42,0.28)] md:px-6 md:py-5">
                                        <div className="space-y-3.5">
                                            <h1 className="product-detail-title max-w-3xl text-[1.14rem] font-semibold leading-[1.34] tracking-[-0.015em] text-foreground/96 [text-wrap:balance] md:text-[1.38rem]">
                                                {displayProduct.name}
                                            </h1>

                                            {metaLoading ? (
                                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    <span>{t('common.loading')}</span>
                                                </div>
                                            ) : showReviewSummary ? (
                                                <div className="flex w-fit flex-wrap items-center gap-3 rounded-full border border-border/35 bg-card/72 px-3.5 py-1.5 text-sm text-muted-foreground">
                                                    <StarRating rating={Math.round(averageRatingState)} size="sm" />
                                                    <span className="font-medium text-foreground">{averageRatingState.toFixed(1)}</span>
                                                    <span>{reviewCountState} {t('review.title')}</span>
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>

                                    <div className="rounded-[1.55rem] border border-border/20 bg-background/55 p-5 md:p-6">
                                        <div className="prose prose-sm max-w-none break-words text-foreground/88 dark:prose-invert md:prose-base">
                                            <ReactMarkdown>
                                                {displayProduct.description || t('buy.noDescription')}
                                            </ReactMarkdown>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 lg:sticky lg:top-24">
                        <Card className="tech-card overflow-hidden border-border/35">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.12),_transparent_36%)] dark:bg-[radial-gradient(circle_at_top_right,_rgba(96,165,250,0.14),_transparent_40%)]" />
                            <CardContent className="relative space-y-6 p-6">
                                {variants.length > 1 && (
                                    <div className="space-y-2">
                                        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                                            {t('buy.selectVariant')}
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {variants.map((v) => {
                                                const isSelected = v.id === selectedVariantId
                                                return (
                                                    <Button
                                                        key={v.id}
                                                        type="button"
                                                        variant={isSelected ? "default" : "outline"}
                                                        size="sm"
                                                        className="rounded-xl font-medium"
                                                        onClick={() => setSelectedVariantId(v.id)}
                                                    >
                                                        {v.variantLabel || v.id}
                                                    </Button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}
                                <div className="space-y-3">
                                    <div className="space-y-1">
                                        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                                            {t('buy.title')}
                                        </div>
                                        <div className="flex flex-wrap items-baseline gap-2">
                                            <span className="text-3xl font-semibold tracking-tight text-primary tabular-nums">
                                                {priceValue}
                                            </span>
                                            <span className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                                                {t('common.credits')}
                                            </span>
                                            {compareAtPriceValue && compareAtPriceValue > priceValue && (
                                                <>
                                                    <span className="text-sm tabular-nums text-muted-foreground/50 line-through">
                                                        {compareAtPriceValue}
                                                    </span>
                                                    <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-600 dark:bg-red-500/15 dark:text-red-400">
                                                        -{Math.round((1 - priceValue / compareAtPriceValue) * 100)}%
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        <Badge
                                            variant={displayStock > 0 ? "outline" : "destructive"}
                                            className={displayStock > 0 ? "rounded-lg border-primary/25 bg-primary/5 px-3 py-1.5 text-primary font-medium" : "rounded-lg px-3 py-1.5 font-medium"}
                                        >
                                            {stockLabel}
                                        </Badge>
                                        {displaySold > 0 && (
                                            <Badge variant="secondary" className="rounded-lg border border-border/40 bg-muted/40 px-3 py-1.5 font-medium">
                                                {t('common.sold')}: {displaySold}
                                            </Badge>
                                        )}
                                        {typeof displayProduct.purchaseLimit === 'number' && displayProduct.purchaseLimit > 0 && (
                                            <Badge variant="secondary" className="rounded-lg border border-border/40 bg-muted/40 px-3 py-1.5 font-medium">
                                                {t('buy.purchaseLimit', { limit: displayProduct.purchaseLimit })}
                                            </Badge>
                                        )}
                                    </div>
                                </div>

                                {isLoggedIn && hasStock && needsQuestionVerification && (
                                    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
                                        <div className="text-[11px] font-semibold uppercase tracking-widest text-amber-700 dark:text-amber-300">
                                            {t('buy.questionsTitle')}
                                        </div>
                                        <p className="text-xs text-muted-foreground">{t('buy.questionsHint')}</p>
                                        {questions.map((q, idx) => (
                                            <div key={idx} className="space-y-1">
                                                <label className="text-sm font-medium text-foreground">{q.q}</label>
                                                <Input
                                                    value={questionAnswers[idx] || ''}
                                                    onChange={(e) => {
                                                        const next = [...questionAnswers]
                                                        next[idx] = e.target.value
                                                        setQuestionAnswers(next)
                                                        setQuestionError(false)
                                                    }}
                                                    placeholder={t('buy.answerPlaceholder')}
                                                    className="rounded-xl"
                                                />
                                            </div>
                                        ))}
                                        {questionError && (
                                            <p className="text-sm font-medium text-destructive">{t('buy.questionsWrong')}</p>
                                        )}
                                        <Button
                                            type="button"
                                            size="sm"
                                            className="rounded-xl"
                                            onClick={handleVerifyAnswers}
                                            disabled={questionAnswers.some((a) => !a.trim())}
                                        >
                                            {t('buy.verifyAnswers')}
                                        </Button>
                                    </div>
                                )}

                                {isLoggedIn && hasStock && !needsQuestionVerification && (
                                    <div className="rounded-2xl border border-border/25 bg-muted/20 p-4">
                                        <div className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                                            {t('buy.modal.total')}
                                        </div>
                                        <div className="space-y-3">
                                            <div className="flex items-center overflow-hidden rounded-xl border border-border/40 bg-background/95 shadow-sm">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-12 w-12 shrink-0 rounded-none text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:opacity-40"
                                                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                                    disabled={quantity <= 1}
                                                >
                                                    <Minus className="h-4 w-4" />
                                                </Button>
                                                <Input
                                                    type="number"
                                                    value={quantity}
                                                    onWheel={(e) => e.currentTarget.blur()}
                                                    onChange={(e) => {
                                                        const val = parseInt(e.target.value) || 1
                                                        if (val >= 1 && val <= maxSelectableQuantity) setQuantity(val)
                                                    }}
                                                    onBlur={(e) => {
                                                        let val = parseInt(e.target.value)
                                                        if (isNaN(val) || val < 1) val = 1
                                                        if (val > maxSelectableQuantity) {
                                                            val = maxSelectableQuantity
                                                            toast.error(t('buy.limitExceeded'))
                                                        }
                                                        setQuantity(val)
                                                    }}
                                                    className="h-12 flex-1 rounded-none border-0 bg-transparent text-center text-base font-medium tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                                                    min={1}
                                                    max={maxSelectableQuantity}
                                                />
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-12 w-12 shrink-0 rounded-none text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:opacity-40"
                                                    onClick={() => quantity < maxSelectableQuantity && setQuantity(quantity + 1)}
                                                    disabled={quantity >= maxSelectableQuantity}
                                                >
                                                    <Plus className="h-4 w-4" />
                                                </Button>
                                            </div>
                                            <div className="flex items-center justify-between rounded-xl bg-background/60 px-4 py-3 text-sm">
                                                <span className="text-muted-foreground">{t('buy.modal.total')}</span>
                                                <span className="font-semibold tabular-nums text-foreground">{(priceValue * quantity).toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-3">
                                    {isLoggedIn ? (
                                        needsQuestionVerification ? (
                                            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-4 text-amber-800 dark:text-amber-200">
                                                <p className="text-sm font-medium">{t('buy.answersRequired')}</p>
                                            </div>
                                        ) : hasStock ? (
                                            displayProduct.purchaseWarning && !warningConfirmed ? (
                                                <div className="flex items-center gap-2">
                                                    <Dialog open={showWarningDialog} onOpenChange={setShowWarningDialog}>
                                                        <DialogTrigger asChild>
                                                            <Button
                                                                size="lg"
                                                                className="h-11 flex-1 rounded-full bg-primary px-5 font-medium text-primary-foreground shadow-[0_16px_34px_-20px_rgba(15,23,42,0.55)] transition-all hover:bg-primary/90 hover:shadow-[0_18px_40px_-22px_rgba(15,23,42,0.6)] active:scale-[0.99]"
                                                            >
                                                                {t('common.buyNow')}
                                                            </Button>
                                                        </DialogTrigger>
                                                        <DialogContent className="rounded-2xl sm:max-w-md">
                                                            <DialogHeader>
                                                                <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                                                                    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                                    </svg>
                                                                    {t('buy.warningTitle')}
                                                                </DialogTitle>
                                                            </DialogHeader>
                                                            <div className="py-4 text-sm leading-relaxed text-muted-foreground">
                                                                <div className="prose prose-sm max-w-none dark:prose-invert [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                                                                    <ReactMarkdown>{displayProduct.purchaseWarning || ''}</ReactMarkdown>
                                                                </div>
                                                            </div>
                                                            <div className="flex justify-end gap-3">
                                                                <Button
                                                                    variant="outline"
                                                                    className="rounded-xl"
                                                                    onClick={() => setShowWarningDialog(false)}
                                                                >
                                                                    {t('common.cancel')}
                                                                </Button>
                                                                <Button
                                                                    onClick={() => {
                                                                        setWarningConfirmed(true)
                                                                        setShowWarningDialog(false)
                                                                    }}
                                                                    className="rounded-xl bg-primary font-medium text-primary-foreground hover:bg-primary/90"
                                                                >
                                                                    {t('buy.confirmWarning')}
                                                                </Button>
                                                            </div>
                                                        </DialogContent>
                                                    </Dialog>
                                                    {renderShareButton(true)}
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <BuyButton
                                                        productId={displayProduct.id}
                                                        price={displayProduct.price}
                                                        productName={displayProduct.name}
                                                        quantity={quantity}
                                                        maxPointsDiscount={displayProduct.maxPointsDiscount}
                                                        autoOpen={warningConfirmed && !!displayProduct.purchaseWarning}
                                                        emailConfigured={emailConfiguredState}
                                                        answers={hasQuestions ? questionAnswers : undefined}
                                                        className="h-11 flex-1 rounded-full bg-primary px-5 font-medium text-primary-foreground shadow-[0_16px_34px_-20px_rgba(15,23,42,0.55)] transition-all hover:bg-primary/90 hover:shadow-[0_18px_40px_-22px_rgba(15,23,42,0.6)]"
                                                    />
                                                    {renderShareButton(true)}
                                                </div>
                                            )
                                        ) : displayLocked > 0 ? (
                                            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-4 text-amber-800 dark:text-amber-200">
                                                <div className="flex items-start gap-3">
                                                    <svg className="mt-0.5 h-5 w-5 shrink-0 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    <p className="text-sm font-medium leading-relaxed">
                                                        {t('buy.stockLockedMessage')}
                                                    </p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="rounded-xl border border-destructive/15 bg-destructive/5 px-4 py-4 text-destructive">
                                                <div className="flex items-center gap-3">
                                                    <svg className="h-5 w-5 shrink-0 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                    </svg>
                                                    <p className="font-medium">{t('buy.outOfStockMessage')}</p>
                                                </div>
                                            </div>
                                        )
                                    ) : (
                                        <div className="rounded-xl border border-border/30 bg-muted/25 px-4 py-4 text-muted-foreground">
                                            <div className="flex items-center gap-3">
                                                <svg className="h-5 w-5 shrink-0 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                </svg>
                                                <p className="text-sm font-medium">{t('buy.loginToBuy')}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {!showInlineShareAction && (
                                    <div className="flex justify-end">
                                        {renderShareButton(false)}
                                    </div>
                                )}

                                <div className="rounded-xl border border-border/20 bg-muted/10 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                                    {t('buy.paymentTimeoutNotice')}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </section>

                <Card id="reviews" className="tech-card scroll-mt-20 overflow-hidden border-border/35">
                    <CardHeader className="border-b border-border/20 pb-5">
                        <CardTitle className="text-2xl tracking-tight">
                            {t('review.title')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-6">
                        {canReviewState && reviewOrderIdState && (
                            <div className="rounded-xl border border-border/30 bg-muted/15 p-5">
                                <h3 className="mb-3 text-sm font-semibold text-foreground">{t('review.leaveReview')}</h3>
                                <ReviewForm
                                productId={displayProduct.id}
                                    orderId={reviewOrderIdState}
                                    onSuccess={() => setMetaRefreshSeq((prev) => prev + 1)}
                                />
                            </div>
                        )}
                        {metaLoading ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>{t('common.loading')}</span>
                            </div>
                        ) : (
                            <ReviewList
                                reviews={reviewsState}
                                averageRating={averageRatingState}
                                totalCount={reviewCountState}
                                productId={displayProduct.id}
                                isLoggedIn={isLoggedIn}
                                onReplySubmitted={() => setMetaRefreshSeq((prev) => prev + 1)}
                            />
                        )}
                    </CardContent>
                </Card>
            </div>

            <Dialog open={isGalleryDialogOpen} onOpenChange={setIsGalleryDialogOpen}>
                <DialogContent className="max-w-5xl border-border/40 bg-background/96 p-3 sm:p-4">
                    <DialogHeader className="sr-only">
                        <DialogTitle>{displayProduct.name}</DialogTitle>
                        <DialogDescription>{t('buy.shareDescription')}</DialogDescription>
                    </DialogHeader>
                    <div className="relative flex min-h-[60vh] items-center justify-center overflow-hidden rounded-2xl bg-muted/20 p-4 md:min-h-[72vh]">
                        {activeGalleryImage ? (
                            <div className="relative h-[60vh] w-full md:h-[72vh]">
                                <Image
                                    src={activeGalleryImage}
                                    alt={displayProduct.name}
                                    fill
                                    sizes="90vw"
                                    className="object-contain"
                                    draggable={false}
                                />
                            </div>
                        ) : null}
                        {canSwitchGallery && (
                            <>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="icon"
                                    className="absolute left-3 top-1/2 h-11 w-11 -translate-y-1/2 rounded-full border border-border/40 bg-background/90 shadow-lg"
                                    onClick={showPreviousGalleryImage}
                                    aria-label="Previous image"
                                >
                                    <ChevronLeft className="h-5 w-5" />
                                </Button>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="icon"
                                    className="absolute right-3 top-1/2 h-11 w-11 -translate-y-1/2 rounded-full border border-border/40 bg-background/90 shadow-lg"
                                    onClick={showNextGalleryImage}
                                    aria-label="Next image"
                                >
                                    <ChevronRight className="h-5 w-5" />
                                </Button>
                                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-border/30 bg-background/88 px-3 py-1 text-xs font-medium text-muted-foreground">
                                    {activeGalleryIndex + 1} / {galleryImages.length}
                                </div>
                            </>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </main>
    )
}
