'use client'

import { saveProduct } from "@/actions/admin"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useState } from "react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { useI18n } from "@/lib/i18n/context"

export default function ProductForm({ product }: { product?: any }) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const { t } = useI18n()

    async function handleSubmit(formData: FormData) {
        setLoading(true)
        try {
            await saveProduct(formData)
            toast.success(t('common.success'))
            router.push('/admin')
        } catch (e) {
            toast.error(t('common.error'))
        } finally {
            setLoading(false)
        }
    }

    return (
        <Card className="max-w-2xl mx-auto">
            <CardHeader>
                <CardTitle>{product ? t('admin.productForm.editTitle') : t('admin.productForm.addTitle')}</CardTitle>
            </CardHeader>
            <CardContent>
                <form action={handleSubmit} className="space-y-4">
                    {product && <input type="hidden" name="id" value={product.id} />}

                    <div className="grid gap-2">
                        <Label htmlFor="name">{t('admin.productForm.nameLabel')}</Label>
                        <Input id="name" name="name" defaultValue={product?.name} placeholder={t('admin.productForm.namePlaceholder')} required />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="price">{t('admin.productForm.priceLabel')}</Label>
                        <Input id="price" name="price" type="number" step="0.01" defaultValue={product?.price} placeholder={t('admin.productForm.pricePlaceholder')} required />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="category">{t('admin.productForm.categoryLabel')}</Label>
                        <Input id="category" name="category" defaultValue={product?.category} placeholder={t('admin.productForm.categoryPlaceholder')} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="image">{t('admin.productForm.imageLabel')}</Label>
                        <Input id="image" name="image" defaultValue={product?.image} placeholder={t('admin.productForm.imagePlaceholder')} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="description">{t('admin.productForm.descLabel')}</Label>
                        <textarea
                            id="description"
                            name="description"
                            defaultValue={product?.description}
                            placeholder={t('admin.productForm.descPlaceholder')}
                            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
