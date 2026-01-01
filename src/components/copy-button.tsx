'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Check, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/context'

interface CopyButtonProps {
    text: string
    label?: string
    truncate?: boolean
    maxLength?: number
}

export function CopyButton({ text, label, truncate = false, maxLength = 20 }: CopyButtonProps) {
    const [copied, setCopied] = useState(false)
    const { t } = useI18n()

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(text)
            setCopied(true)
            toast.success(t('common.copied'))
            setTimeout(() => setCopied(false), 2000)
        } catch (err) {
            toast.error(t('common.copyFailed'))
        }
    }

    const displayText = truncate && text.length > maxLength
        ? `${text.substring(0, maxLength)}...`
        : text

    return (
        <div className="flex items-center gap-2">
            {label && <span className="text-muted-foreground">{label}</span>}
            <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                {displayText}
            </code>
            <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-8 w-8 p-0"
            >
                {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                ) : (
                    <Copy className="h-4 w-4" />
                )}
            </Button>
        </div>
    )
}
