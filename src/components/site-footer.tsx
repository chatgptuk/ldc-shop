'use client'

import { useI18n } from "@/lib/i18n/context"

export function SiteFooter() {
    const { t } = useI18n()

    return (
        <footer className="border-t border-border/50 py-6 md:py-0 bg-gradient-to-t from-muted/30 to-transparent">
            <div className="container flex flex-col items-center justify-between gap-4 md:h-20 md:flex-row">
                <div className="flex flex-col items-center gap-4 px-8 md:flex-row md:gap-2 md:px-0">
                    <p className="text-center text-xs leading-loose text-muted-foreground/80 md:text-left">
                        {t('footer.disclaimer')}
                    </p>
                </div>
                <a href="https://github.com/chatgptuk/ldc-shop" target="_blank" rel="noreferrer" className="text-center text-xs md:text-left text-muted-foreground/60 hover:text-primary transition-colors duration-300">
                    GitHub: ldc-shop
                </a>
            </div>
        </footer>
    )
}
