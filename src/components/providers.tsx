'use client'

import { I18nProvider } from '@/lib/i18n/context'
import { Toaster } from 'sonner'

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <I18nProvider>
            {children}
            <Toaster position="top-center" richColors />
        </I18nProvider>
    )
}
