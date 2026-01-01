'use client'

import Link from "next/link"
import { useI18n } from "@/lib/i18n/context"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { LanguageSwitcher } from "@/components/language-switcher"

export function HeaderNav({ isAdmin }: { isAdmin: boolean }) {
    const { t } = useI18n()

    return (
        <>
            {isAdmin && (
                <Link href="/admin" className="flex items-center text-sm font-medium text-muted-foreground hover:text-primary">
                    {t('common.admin')}
                </Link>
            )}
        </>
    )
}

export function HeaderUserMenuItems({ isAdmin }: { isAdmin: boolean }) {
    const { t } = useI18n()

    return (
        <>
            <DropdownMenuItem asChild>
                <Link href="/orders">{t('common.myOrders')}</Link>
            </DropdownMenuItem>
            {isAdmin && (
                <DropdownMenuItem asChild>
                    <Link href="/admin">{t('common.dashboard')}</Link>
                </DropdownMenuItem>
            )}
        </>
    )
}

export { LanguageSwitcher }
