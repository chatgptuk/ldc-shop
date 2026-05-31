'use client'

import { getProductForAdminAction, saveProduct } from "@/actions/admin"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { useI18n } from "@/lib/i18n/context"

export default function ProductForm({ product, categories = [] }: { product?: any; categories?: Array<{ name: string }> }) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const submitLock = useRef(false)
    const [currentProduct, setCurrentProduct] = useState(product)
    const [formSeed, setFormSeed] = useState(0)
    // Only show warning section if purchaseWarning has actual content
    const [showWarning, setShowWarning] = useState(Boolean(product?.purchaseWarning && String(product.purchaseWarning).trim()))
    const [visibilityLevel, setVisibilityLevel] = useState(String(product?.visibilityLevel ?? -1))
    const { t } = useI18n()

    useEffect(() => {
        setCurrentProduct(product)
        setShowWarning(Boolean(product?.purchaseWarning && String(product.purchaseWarning).trim()))
        setVisibilityLevel(String(product?.visibilityLevel ?? -1))
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
                        <Input id="price" name="price" type="number" step="0.01" defaultValue={currentProduct?.price} placeholder={t('admin.productForm.pricePlaceholder')} required />
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
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="purchaseLimit">{t('admin.productForm.purchaseLimitLabel') || "Per-user Purchase Limit (0 or empty for unlimited)"}</Label>
                        <Input id="purchaseLimit" name="purchaseLimit" type="number" defaultValue={currentProduct?.purchaseLimit} placeholder={t('admin.productForm.purchaseLimitPlaceholder') || "e.g. 1"} />
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

                    <div className="grid gap-2">
                        <Label htmlFor="image">{t('admin.productForm.imageLabel')}</Label>
                        <Input id="image" name="image" defaultValue={currentProduct?.image} placeholder={t('admin.productForm.imagePlaceholder')} />
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
