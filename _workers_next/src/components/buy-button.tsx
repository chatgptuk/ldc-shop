'use client'

import { useState, useEffect, useRef } from "react"
import { createOrder } from "@/actions/checkout"
import { getUserPoints } from "@/actions/points"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Loader2, Coins } from "lucide-react"
import { toast } from "sonner"
import { useI18n } from "@/lib/i18n/context"
import { cn } from "@/lib/utils"

interface BuyButtonProps {
    productId: string
    price: string | number
    productName: string
    disabled?: boolean
    quantity?: number
    autoOpen?: boolean
    emailConfigured?: boolean
    answers?: string[]
    className?: string
    maxPointsDiscount?: string | number | null
}

function getMaxPointDeduction(totalAmount: number, quantity: number, maxPointsDiscount: string | number | null | undefined) {
    const rawLimit = typeof maxPointsDiscount === 'string' ? maxPointsDiscount.trim() : maxPointsDiscount
    if (rawLimit === null || rawLimit === undefined || rawLimit === '') {
        return Math.ceil(totalAmount)
    }

    const unitLimit = Number(rawLimit)
    if (!Number.isFinite(unitLimit) || unitLimit < 0) {
        return Math.ceil(totalAmount)
    }

    const cappedAmount = Math.min(totalAmount, unitLimit * quantity)
    if (cappedAmount >= totalAmount) {
        return Math.ceil(totalAmount)
    }

    return Math.floor(Math.max(0, cappedAmount))
}

export function BuyButton({ productId, price, productName, disabled, quantity = 1, autoOpen = false, emailConfigured = false, answers, className, maxPointsDiscount }: BuyButtonProps) {
    const [loading, setLoading] = useState(false)
    const [open, setOpen] = useState(false)
    const [points, setPoints] = useState(0)
    const [usePoints, setUsePoints] = useState(false)
    const [pointsLoading, setPointsLoading] = useState(false)
    const [hasAutoOpened, setHasAutoOpened] = useState(false)
    const [email, setEmail] = useState('')
    const isNavigatingRef = useRef(false)
    const { t } = useI18n()

    const numericalPrice = Number(price) * quantity

    const openDialog = async () => {
        if (disabled) return
        setOpen(true)
        setPointsLoading(true)
        try {
            const p = await getUserPoints()
            setPoints(p)
            setUsePoints(p > 0)
        } catch (e) {
            console.error(e)
            setUsePoints(false)
        } finally {
            setPointsLoading(false)
        }
    }

    // Auto-open dialog when autoOpen is true (after warning confirmation)
    useEffect(() => {
        if (autoOpen && !hasAutoOpened && !disabled) {
            setHasAutoOpened(true)
            openDialog()
        }
    }, [autoOpen, hasAutoOpened, disabled])

    const handleInitialClick = async () => {
        await openDialog()
    }

    const handleBuy = async () => {
        if (isNavigatingRef.current) return

        try {
            setLoading(true)
            const result = await createOrder(productId, quantity, email, usePoints, answers)

            if (!result?.success) {
                const message = result?.error ? t(result.error) : t('common.error')
                toast.error(message)
                if (!isNavigatingRef.current) setLoading(false)
                return
            }

            if (result.isZeroPrice && result.url) {
                // Mark as navigating to prevent further state updates
                isNavigatingRef.current = true
                toast.success(t('buy.paymentSuccessPoints'))
                window.location.href = result.url
                return
            }

            const { params } = result

            if (!params) {
                toast.error(t('common.error'))
                if (!isNavigatingRef.current) setLoading(false)
                return
            }

            if (params) {
                // Mark as navigating to prevent React errors on Safari
                isNavigatingRef.current = true

                // Submit Form immediately without closing dialog
                const form = document.createElement('form')
                form.method = 'POST'
                form.action = '/paying'

                Object.entries(params as Record<string, any>).forEach(([k, v]) => {
                    const input = document.createElement('input')
                    input.type = 'hidden'
                    input.name = k
                    input.value = String(v)
                    form.appendChild(input)
                })

                document.body.appendChild(form)
                form.submit()
                return
            }

        } catch (e: any) {
            if (!isNavigatingRef.current) {
                toast.error(e.message || "Failed to create order")
                setLoading(false)
            }
        }
    }

    // Calculation for UI
    const maxPointDeduction = getMaxPointDeduction(numericalPrice, quantity, maxPointsDiscount)
    const pointsToUse = usePoints ? Math.min(points, maxPointDeduction) : 0
    const finalPrice = Math.max(0, numericalPrice - pointsToUse)

    return (
        <>
            <Button
                size="lg"
                className={cn(
                    "h-12 w-full rounded-xl bg-primary px-6 font-medium text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/25 active:scale-[0.99] disabled:opacity-50",
                    className
                )}
                onClick={handleInitialClick}
                disabled={disabled}
            >
                {t('common.buyNow')}
            </Button>

            <Dialog open={open} onOpenChange={(v) => !isNavigatingRef.current && setOpen(v)}>
                <DialogContent className="rounded-2xl sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{t('common.buyNow')}</DialogTitle>
                        <DialogDescription>{productName} {quantity > 1 ? `x ${quantity}` : ''}</DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="flex justify-between items-center">
                            <span className="font-medium">{t('buy.modal.price')}</span>
                            <span>{numericalPrice.toFixed(2)}</span>
                        </div>

                    <div className="floating-field">
                        <Input
                            id="email"
                            type="text"
                            placeholder=" "
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                        <Label htmlFor="email" className="floating-label">
                            {emailConfigured ? t('buy.modal.emailLabelConfigured') : t('buy.modal.emailLabelUnconfigured')}
                        </Label>
                    </div>

                        {points > 0 && maxPointDeduction > 0 && (
                            <div className="flex items-center space-x-2 border p-3 rounded-md">
                                <input
                                    type="checkbox"
                                    id="use-points"
                                    checked={usePoints}
                                    onChange={(e) => setUsePoints(e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                />
                                <Label htmlFor="use-points" className="flex-1 flex justify-between cursor-pointer">
                                    <span className="flex items-center gap-1">
                                        {t('buy.modal.usePoints')} <Coins className="w-3 h-3 text-yellow-500" />
                                    </span>
                                    <span className="text-muted-foreground">
                                        {t('buy.modal.pointsDetails', { points: pointsToUse, available: points })}
                                    </span>
                                </Label>
                            </div>
                        )}

                        <div className="flex justify-between items-center border-t pt-4 font-bold text-lg">
                            <span>{t('buy.modal.total')}</span>
                            <span>{finalPrice.toFixed(2)}</span>
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" className="rounded-xl" onClick={() => setOpen(false)} disabled={loading}>
                            {t('common.cancel')}
                        </Button>
                        <Button onClick={handleBuy} disabled={loading} className="rounded-xl bg-primary font-medium text-primary-foreground hover:bg-primary/90">
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {finalPrice === 0 ? t('buy.modal.payWithPoints') : t('buy.modal.proceedPayment')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
