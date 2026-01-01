'use client'

import { Button } from "@/components/ui/button"
import { getRefundParams, checkRefundStatus } from "@/actions/refund"
import { useState } from "react"
import { toast } from "sonner"
import { Loader2, ExternalLink, RefreshCw } from "lucide-react"

export function RefundButton({ order }: { order: any }) {
    const [loading, setLoading] = useState(false)
    const [showCheckStatus, setShowCheckStatus] = useState(false)

    if (order.status !== 'delivered' && order.status !== 'paid') return null
    if (!order.tradeNo) return null

    const handleRefund = async () => {
        if (!confirm(`This will open the refund page in a new tab. After completing the refund, click "Check Status" to verify. Continue?`)) return

        setLoading(true)
        try {
            const params = await getRefundParams(order.orderId)

            // Create and submit form in new tab
            const form = document.createElement('form')
            form.method = 'POST'
            form.action = 'https://credit.linux.do/epay/api.php'
            form.target = '_blank'

            Object.entries(params).forEach(([k, v]) => {
                const input = document.createElement('input')
                input.type = 'hidden'
                input.name = k
                input.value = String(v)
                form.appendChild(input)
            })

            document.body.appendChild(form)
            form.submit()
            document.body.removeChild(form)

            // Show the "Check Status" button
            setShowCheckStatus(true)
            toast.info("Complete the refund in the new tab, then click 'Check Status'")
        } catch (e: any) {
            toast.error(e.message)
        } finally {
            setLoading(false)
        }
    }

    const handleCheckStatus = async () => {
        setLoading(true)
        try {
            const result = await checkRefundStatus(order.orderId)
            if (result.refunded) {
                toast.success(result.message)
                setShowCheckStatus(false)
                // Page will revalidate and show updated status
            } else {
                toast.warning(result.message)
            }
        } catch (e: any) {
            toast.error(e.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRefund} disabled={loading}>
                {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <><ExternalLink className="h-3 w-3 mr-1" />Refund</>}
            </Button>
            {showCheckStatus && (
                <Button variant="default" size="sm" onClick={handleCheckStatus} disabled={loading}>
                    {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <><RefreshCw className="h-3 w-3 mr-1" />Check Status</>}
                </Button>
            )}
        </div>
    )
}
