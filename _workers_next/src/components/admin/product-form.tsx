'use client'

import { getProductForAdminAction, saveProduct } from "@/actions/admin"
import { prepareUploadedImage } from "@/lib/client-image"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { type ChangeEvent, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { useI18n } from "@/lib/i18n/context"
import {
    PRODUCT_GALLERY_MAX_ITEMS,
    normalizeProductImageRefs,
    parseStoredProductImages,
} from "@/lib/product-images"

const PRODUCT_IMAGE_UPLOAD_MAX_BYTES = 500 * 1024

export default function ProductForm({ product, categories = [] }: { product?: any; categories?: Array<{ name: string }> }) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const submitLock = useRef(false)
    const productImageFileInputRef = useRef<HTMLInputElement | null>(null)
    const productGalleryFileInputRef = useRef<HTMLInputElement | null>(null)
    const [currentProduct, setCurrentProduct] = useState(product)
    const [formSeed, setFormSeed] = useState(0)
    // Only show warning section if purchaseWarning has actual content
    const [showWarning, setShowWarning] = useState(Boolean(product?.purchaseWarning && String(product.purchaseWarning).trim()))
    const [visibilityLevel, setVisibilityLevel] = useState(String(product?.visibilityLevel ?? -1))
    const [productImageValue, setProductImageValue] = useState(product?.image || '')
    const [productGalleryValues, setProductGalleryValues] = useState<string[]>(() => parseStoredProductImages(product?.productImages))
    const [galleryImageInputValue, setGalleryImageInputValue] = useState('')
    const [processingProductImageFile, setProcessingProductImageFile] = useState(false)
    const [processingProductGalleryFiles, setProcessingProductGalleryFiles] = useState(false)
    const [purchaseQuestions, setPurchaseQuestions] = useState<Array<{ q: string; a: string }>>(() => {
        try {
            const raw = product?.purchaseQuestions
            if (raw) {
                const parsed = JSON.parse(raw)
                if (Array.isArray(parsed) && parsed.length > 0) return parsed
            }
        } catch { /* ignore */ }
        return []
    })
    const [showQuestions, setShowQuestions] = useState(purchaseQuestions.length > 0)
    const { t } = useI18n()
    const usingUploadedProductImage = productImageValue.startsWith('data:')
    const productImageInputValue = usingUploadedProductImage ? '' : productImageValue
    const hasRoomForMoreGalleryImages = productGalleryValues.length < PRODUCT_GALLERY_MAX_ITEMS - 1

    useEffect(() => {
        setCurrentProduct(product)
        setShowWarning(Boolean(product?.purchaseWarning && String(product.purchaseWarning).trim()))
        setVisibilityLevel(String(product?.visibilityLevel ?? -1))
        setProductImageValue(product?.image || '')
        setProductGalleryValues(parseStoredProductImages(product?.productImages))
        setGalleryImageInputValue('')
        try {
            const raw = product?.purchaseQuestions
            if (raw) {
                const parsed = JSON.parse(raw)
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setPurchaseQuestions(parsed)
                    setShowQuestions(true)
                } else {
                    setPurchaseQuestions([])
                    setShowQuestions(false)
                }
            } else {
                setPurchaseQuestions([])
                setShowQuestions(false)
            }
        } catch {
            setPurchaseQuestions([])
            setShowQuestions(false)
        }
        setFormSeed((s) => s + 1)
    }, [product?.id])

    useEffect(() => {
        if (!product?.id) return
        let active = true
            ; (async () => {
                try {
                    const latest = await getProductForAdminAction(product.id)
                    if (!active || !latest) return
                    setCurrentProduct(latest as any)
                    setShowWarning(Boolean(latest?.purchaseWarning && String(latest.purchaseWarning).trim()))
                    setVisibilityLevel(String(latest?.visibilityLevel ?? -1))
                    setProductImageValue(latest?.image || '')
                    setProductGalleryValues(parseStoredProductImages((latest as any)?.productImages))
                    setGalleryImageInputValue('')
                    try {
                        const raw = (latest as any)?.purchaseQuestions
                        if (raw) {
                            const parsed = JSON.parse(raw)
                            if (Array.isArray(parsed) && parsed.length > 0) {
                                setPurchaseQuestions(parsed)
                                setShowQuestions(true)
                            }
                        }
                    } catch { /* ignore */ }
                    setFormSeed((s) => s + 1)
                } catch {
                    // ignore
                }
            })()
        return () => {
            active = false
        }
    }, [product?.id])

    async function handleSubmit(formData: FormData) {
        if (submitLock.current) return
        submitLock.current = true
        setLoading(true)
        try {
            await saveProduct(formData)
            toast.success(t('common.success'))
            router.push('/admin/products')
        } catch (e: any) {
            console.error('Save product error:', e)
            toast.error(e?.message || t('common.error'))
        } finally {
            setLoading(false)
            submitLock.current = false
        }
    }

    const handleSelectProductImageFile = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (!file) return

        setProcessingProductImageFile(true)
        try {
            const prepared = await prepareUploadedImage(file, {
                maxBytes: PRODUCT_IMAGE_UPLOAD_MAX_BYTES,
                maxDimension: 1600,
            })
            setProductImageValue(prepared.dataUrl)
            toast.success(
                prepared.wasCompressed
                    ? t('admin.productForm.imageFileCompressed')
                    : t('admin.productForm.imageFileReady')
            )
        } catch (error) {
            const message = error instanceof Error ? error.message : ''
            if (message === 'image_compression_unsupported') {
                toast.error(t('admin.productForm.imageFileCompressionUnsupported'))
                return
            }
            if (message === 'image_compression_failed') {
                toast.error(t('admin.productForm.imageFileCompressionFailed'))
                return
            }
            toast.error(t('admin.productForm.imageFileInvalid'))
        } finally {
            setProcessingProductImageFile(false)
        }
    }

    const handleAddGalleryImage = () => {
        const nextImage = galleryImageInputValue.trim()
        if (!nextImage) return
        setProductGalleryValues((prev) => normalizeProductImageRefs([...prev, nextImage]).slice(0, PRODUCT_GALLERY_MAX_ITEMS - 1))
        setGalleryImageInputValue('')
    }

    const handlePromoteGalleryImage = (index: number) => {
        const nextPrimary = productGalleryValues[index]
        if (!nextPrimary) return
        const currentPrimary = productImageValue.trim()

        setProductImageValue(nextPrimary)
        setProductGalleryValues((prev) => {
            const remaining = prev.filter((_, i) => i !== index)
            return normalizeProductImageRefs(currentPrimary ? [currentPrimary, ...remaining] : remaining)
        })
    }

    const handleRemoveGalleryImage = (index: number) => {
        setProductGalleryValues((prev) => prev.filter((_, i) => i !== index))
    }

    const handleSelectProductGalleryFiles = async (event: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files || [])
        event.target.value = ''
        if (!files.length) return

        setProcessingProductGalleryFiles(true)
        try {
            const preparedImages: string[] = []
            let compressedCount = 0

            for (const file of files) {
                const prepared = await prepareUploadedImage(file, {
                    maxBytes: PRODUCT_IMAGE_UPLOAD_MAX_BYTES,
                    maxDimension: 1600,
                })
                preparedImages.push(prepared.dataUrl)
                if (prepared.wasCompressed) compressedCount += 1
            }

            setProductGalleryValues((prev) =>
                normalizeProductImageRefs([...prev, ...preparedImages]).slice(0, PRODUCT_GALLERY_MAX_ITEMS - 1)
            )

            toast.success(
                compressedCount > 0
                    ? t('admin.productForm.galleryFileCompressed')
                    : t('admin.productForm.galleryFileReady')
            )
        } catch (error) {
            const message = error instanceof Error ? error.message : ''
            if (message === 'image_compression_unsupported') {
                toast.error(t('admin.productForm.imageFileCompressionUnsupported'))
                return
            }
            if (message === 'image_compression_failed') {
                toast.error(t('admin.productForm.imageFileCompressionFailed'))
                return
            }
            toast.error(t('admin.productForm.imageFileInvalid'))
        } finally {
            setProcessingProductGalleryFiles(false)
        }
    }

    return (
        <Card className="max-w-2xl mx-auto">
            <CardHeader>
                <CardTitle>{product ? t('admin.productForm.editTitle') : t('admin.productForm.addTitle')}</CardTitle>
            </CardHeader>
            <CardContent>
                <form key={formSeed} action={handleSubmit} className="space-y-5">
                    {currentProduct && <input type="hidden" name="id" value={currentProduct.id} />}

                    <div className="grid gap-2">
                        <Label htmlFor="slug">{t('admin.productForm.slugLabel')}</Label>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">/buy/</span>
                            <Input
                                id="slug"
                                name="slug"
                                defaultValue={currentProduct?.id || ''}
                                placeholder={t('admin.productForm.slugPlaceholder')}
                                pattern="^[a-zA-Z0-9_-]+$"
                                className="flex-1"
                                disabled={!!currentProduct}
                            />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {currentProduct ? t('admin.productForm.slugReadonly') : t('admin.productForm.slugHint')}
                        </p>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="name">{t('admin.productForm.nameLabel')}</Label>
                        <Input id="name" name="name" defaultValue={currentProduct?.name} placeholder={t('admin.productForm.namePlaceholder')} required />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="price">{t('admin.productForm.priceLabel')}</Label>
                        <Input id="price" name="price" type="number" step="0.01" defaultValue={currentProduct?.price} placeholder={t('admin.productForm.pricePlaceholder')} required onWheel={(e) => e.currentTarget.blur()} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="compareAtPrice">{t('admin.productForm.compareAtPriceLabel')}</Label>
                        <Input
                            id="compareAtPrice"
                            name="compareAtPrice"
                            type="number"
                            step="0.01"
                            defaultValue={currentProduct?.compareAtPrice || ''}
                            placeholder={t('admin.productForm.compareAtPricePlaceholder')}
                            onWheel={(e) => e.currentTarget.blur()}
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="purchaseLimit">{t('admin.productForm.purchaseLimitLabel') || "Per-user Purchase Limit (0 or empty for unlimited)"}</Label>
                        <Input id="purchaseLimit" name="purchaseLimit" type="number" defaultValue={currentProduct?.purchaseLimit} placeholder={t('admin.productForm.purchaseLimitPlaceholder') || "e.g. 1"} onWheel={(e) => e.currentTarget.blur()} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="maxPointsDiscount">{t('admin.productForm.maxPointsDiscountLabel')}</Label>
                        <Input
                            id="maxPointsDiscount"
                            name="maxPointsDiscount"
                            type="number"
                            min="0"
                            step="1"
                            defaultValue={currentProduct?.maxPointsDiscount || ''}
                            placeholder={t('admin.productForm.maxPointsDiscountPlaceholder')}
                            onWheel={(e) => e.currentTarget.blur()}
                        />
                        <p className="text-xs text-muted-foreground">{t('admin.productForm.maxPointsDiscountHint')}</p>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="category">{t('admin.productForm.categoryLabel')}</Label>
                        <Input id="category" name="category" list="ldc-category-list" defaultValue={currentProduct?.category} placeholder={t('admin.productForm.categoryPlaceholder')} />
                        <datalist id="ldc-category-list">
                            {categories.map(c => (
                                <option key={c.name} value={c.name} />
                            ))}
                        </datalist>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="variantGroupId">{t('admin.productForm.variantGroupLabel')}</Label>
                        <Input
                            id="variantGroupId"
                            name="variantGroupId"
                            defaultValue={currentProduct?.variantGroupId || ''}
                            placeholder={t('admin.productForm.variantGroupPlaceholder')}
                        />
                        <p className="text-xs text-muted-foreground">{t('admin.productForm.variantGroupHint')}</p>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="variantLabel">{t('admin.productForm.variantLabelLabel')}</Label>
                        <Input
                            id="variantLabel"
                            name="variantLabel"
                            defaultValue={currentProduct?.variantLabel || ''}
                            placeholder={t('admin.productForm.variantLabelPlaceholder')}
                        />
                        <p className="text-xs text-muted-foreground">{t('admin.productForm.variantLabelHint')}</p>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="visibilityLevel">{t('admin.productForm.visibilityLabel')}</Label>
                        <select
                            id="visibilityLevel"
                            name="visibilityLevel"
                            value={visibilityLevel}
                            onChange={(e) => setVisibilityLevel(e.target.value)}
                            className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-2"
                        >
                            <option value="-1">{t('admin.productForm.visibilityAll')}</option>
                            <option value="0">{t('admin.productForm.visibilityLevel0')}</option>
                            <option value="1">{t('admin.productForm.visibilityLevel1')}</option>
                            <option value="2">{t('admin.productForm.visibilityLevel2')}</option>
                            <option value="3">{t('admin.productForm.visibilityLevel3')}</option>
                        </select>
                        <p className="text-xs text-muted-foreground">{t('admin.productForm.visibilityHint')}</p>
                    </div>

                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="isShared"
                            name="isShared"
                            defaultChecked={currentProduct?.isShared ?? false}
                            className="h-4 w-4 accent-primary"
                        />
                        <div className="flex flex-col">
                            <Label htmlFor="isShared" className="cursor-pointer font-medium">{t('admin.productForm.isSharedLabel')}</Label>
                            <span className="text-xs text-muted-foreground">{t('admin.productForm.isSharedHint')}</span>
                        </div>
                    </div>

                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="isHot"
                            name="isHot"
                            defaultChecked={!!currentProduct?.isHot}
                            className="h-4 w-4 accent-primary"
                        />
                        <Label htmlFor="isHot" className="cursor-pointer">{t('admin.productForm.isHotLabel')}</Label>
                    </div>

                    <div className="space-y-2 p-3 border rounded-md bg-muted/30">
                        <div className="flex items-center gap-2">
                            <input
                                id="showWarning"
                                type="checkbox"
                                checked={showWarning}
                                onChange={(e) => setShowWarning(e.target.checked)}
                                className="h-4 w-4 accent-primary"
                            />
                            <Label htmlFor="showWarning" className="cursor-pointer">{t('admin.productForm.purchaseWarningLabel')}</Label>
                        </div>
                        {showWarning && (
                            <div className="grid gap-2">
                                <Label htmlFor="purchaseWarning">{t('admin.productForm.purchaseWarningLabel')}</Label>
                                <Textarea
                                    id="purchaseWarning"
                                    name="purchaseWarning"
                                    defaultValue={currentProduct?.purchaseWarning || ''}
                                    placeholder={t('admin.productForm.purchaseWarningPlaceholder')}
                                    className="min-h-[60px]"
                                />
                                <p className="text-xs text-muted-foreground">{t('admin.productForm.purchaseWarningHint')}</p>
                            </div>
                        )}
                    </div>

                    <div className="space-y-2 p-3 border rounded-md bg-muted/30">
                        <div className="flex items-center gap-2">
                            <input
                                id="showQuestions"
                                type="checkbox"
                                checked={showQuestions}
                                onChange={(e) => {
                                    setShowQuestions(e.target.checked)
                                    if (!e.target.checked) setPurchaseQuestions([])
                                }}
                                className="h-4 w-4 accent-primary"
                            />
                            <Label htmlFor="showQuestions" className="cursor-pointer">{t('admin.productForm.purchaseQuestionsLabel')}</Label>
                        </div>
                        {showQuestions && (
                            <div className="space-y-3">
                                <input type="hidden" name="purchaseQuestions" value={JSON.stringify(purchaseQuestions)} />
                                {purchaseQuestions.map((item, idx) => (
                                    <div key={idx} className="flex items-start gap-2 rounded-md border bg-background/80 p-3">
                                        <div className="flex-1 space-y-2">
                                            <Input
                                                value={item.q}
                                                onChange={(e) => {
                                                    const next = [...purchaseQuestions]
                                                    next[idx] = { ...next[idx], q: e.target.value }
                                                    setPurchaseQuestions(next)
                                                }}
                                                placeholder={t('admin.productForm.questionPlaceholder')}
                                            />
                                            <Input
                                                value={item.a}
                                                onChange={(e) => {
                                                    const next = [...purchaseQuestions]
                                                    next[idx] = { ...next[idx], a: e.target.value }
                                                    setPurchaseQuestions(next)
                                                }}
                                                placeholder={t('admin.productForm.answerPlaceholder')}
                                            />
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="shrink-0 text-destructive hover:text-destructive"
                                            onClick={() => setPurchaseQuestions(purchaseQuestions.filter((_, i) => i !== idx))}
                                        >
                                            ×
                                        </Button>
                                    </div>
                                ))}
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPurchaseQuestions([...purchaseQuestions, { q: '', a: '' }])}
                                >
                                    + {t('admin.productForm.addQuestion')}
                                </Button>
                                <p className="text-xs text-muted-foreground">{t('admin.productForm.purchaseQuestionsHint')}</p>
                            </div>
                        )}
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="image">{t('admin.productForm.imageLabel')}</Label>
                        <input type="hidden" name="image" value={productImageValue} />
                        <Input
                            id="image"
                            value={productImageInputValue}
                            onChange={(e) => setProductImageValue(e.target.value)}
                            placeholder={t('admin.productForm.imagePlaceholder')}
                        />
                        {usingUploadedProductImage && (
                            <p className="text-xs text-muted-foreground">{t('admin.productForm.imageUploadedHint')}</p>
                        )}
                        <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border/60 bg-muted/20 p-3">
                            <Label htmlFor="product-image-file" className="text-sm font-medium">{t('admin.productForm.imageUpload')}</Label>
                            <input
                                ref={productImageFileInputRef}
                                id="product-image-file"
                                type="file"
                                className="hidden"
                                accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/x-icon,image/bmp,.png,.jpg,.jpeg,.webp,.gif,.svg,.ico,.bmp"
                                onChange={handleSelectProductImageFile}
                                disabled={processingProductImageFile}
                            />
                            <Button
                                type="button"
                                variant="outline"
                                className="w-fit"
                                onClick={() => productImageFileInputRef.current?.click()}
                                disabled={processingProductImageFile}
                            >
                                {processingProductImageFile ? t('common.processing') : t('admin.productForm.imageUpload')}
                            </Button>
                            <p className="text-xs text-muted-foreground">{t('admin.productForm.imageUploadHint')}</p>
                        </div>
                        {productImageValue && (
                            <div className="flex items-center gap-4 rounded-md border bg-muted/50 p-2">
                                <img src={productImageValue} alt={currentProduct?.name || 'Product preview'} className="h-14 w-14 rounded object-contain" />
                                <span className="text-sm text-muted-foreground">{t('admin.productForm.imagePreview')}</span>
                            </div>
                        )}
                    </div>

                    <div className="grid gap-3">
                        <Label htmlFor="galleryImageInput">{t('admin.productForm.galleryLabel')}</Label>
                        <input type="hidden" name="productImages" value={JSON.stringify(productGalleryValues)} />
                        <div className="flex gap-2">
                            <Input
                                id="galleryImageInput"
                                value={galleryImageInputValue}
                                onChange={(e) => setGalleryImageInputValue(e.target.value)}
                                placeholder={t('admin.productForm.galleryPlaceholder')}
                                disabled={!hasRoomForMoreGalleryImages}
                            />
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleAddGalleryImage}
                                disabled={!galleryImageInputValue.trim() || !hasRoomForMoreGalleryImages}
                            >
                                {t('admin.productForm.galleryAdd')}
                            </Button>
                        </div>
                        <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border/60 bg-muted/20 p-3">
                            <Label htmlFor="product-gallery-file" className="text-sm font-medium">{t('admin.productForm.galleryUpload')}</Label>
                            <input
                                ref={productGalleryFileInputRef}
                                id="product-gallery-file"
                                type="file"
                                className="hidden"
                                accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/x-icon,image/bmp,.png,.jpg,.jpeg,.webp,.gif,.svg,.ico,.bmp"
                                multiple
                                onChange={handleSelectProductGalleryFiles}
                                disabled={processingProductGalleryFiles || !hasRoomForMoreGalleryImages}
                            />
                            <Button
                                type="button"
                                variant="outline"
                                className="w-fit"
                                onClick={() => productGalleryFileInputRef.current?.click()}
                                disabled={processingProductGalleryFiles || !hasRoomForMoreGalleryImages}
                            >
                                {processingProductGalleryFiles ? t('common.processing') : t('admin.productForm.galleryUpload')}
                            </Button>
                            <p className="text-xs text-muted-foreground">{t('admin.productForm.galleryUploadHint', { count: PRODUCT_GALLERY_MAX_ITEMS - 1 })}</p>
                        </div>
                        {productGalleryValues.length > 0 ? (
                            <div className="grid gap-3 sm:grid-cols-2">
                                {productGalleryValues.map((image, index) => (
                                    <div key={`${image}-${index}`} className="rounded-lg border bg-muted/30 p-3">
                                        <div className="mb-3 flex aspect-[4/3] items-center justify-center overflow-hidden rounded-md bg-background">
                                            <img src={image} alt={`${currentProduct?.name || 'Product'} gallery ${index + 1}`} className="h-full w-full object-contain" />
                                        </div>
                                        <div className="flex gap-2">
                                            <Button type="button" size="sm" variant="outline" onClick={() => handlePromoteGalleryImage(index)}>
                                                {t('admin.productForm.gallerySetCover')}
                                            </Button>
                                            <Button type="button" size="sm" variant="ghost" onClick={() => handleRemoveGalleryImage(index)}>
                                                {t('admin.productForm.galleryRemove')}
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-muted-foreground">{t('admin.productForm.galleryEmpty')}</p>
                        )}
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="description">{t('admin.productForm.descLabel')}</Label>
                        <Textarea
                            id="description"
                            name="description"
                            defaultValue={currentProduct?.description}
                            placeholder={t('admin.productForm.descPlaceholder')}
                            className="min-h-[80px]"
                        />
                    </div>

                    <div className="pt-4 flex justify-end gap-2">
                        <Button variant="outline" type="button" onClick={() => router.back()}>{t('common.cancel')}</Button>
                        <Button type="submit" disabled={loading}>{loading ? t('admin.productForm.saving') : t('admin.productForm.saveButton')}</Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    )
}
