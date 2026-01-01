'use client'

import { useI18n } from "@/lib/i18n/context"

export function SiteFooter() {
    const { t } = useI18n()

    return (
        <footer className="border-t py-6 md:py-0">
            <div className="container flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row">
                <div className="flex flex-col items-center gap-4 px-8 md:flex-row md:gap-2 md:px-0">
                    <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
                        {t('footer.disclaimer')}
                    </p>
                </div>
                <a href="https://chatgpt.org.uk" target="_blank" rel="noreferrer" className="text-center text-sm md:text-left text-muted-foreground hover:underline">
                    {t('footer.poweredBy')} chatgpt.org.uk
                </a>
            </div>
        </footer>
    )
}
