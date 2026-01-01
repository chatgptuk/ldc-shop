'use client'

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Package, CreditCard, LogOut } from "lucide-react"
import { useI18n } from "@/lib/i18n/context"
import { signOut } from "next-auth/react"

export function AdminSidebar({ username }: { username: string }) {
    const { t } = useI18n()

    return (
        <aside className="w-full md:w-64 bg-muted/40 border-r md:min-h-screen p-6 space-y-4">
            <div className="flex items-center gap-2 font-bold text-xl px-2 mb-6">
                <span>{t('common.adminTitle')}</span>
            </div>
            <nav className="flex flex-col gap-2">
                <Button variant="ghost" asChild className="justify-start">
                    <Link href="/admin"><Package className="mr-2 h-4 w-4" />{t('common.dashboardProducts')}</Link>
                </Button>
                <Button variant="ghost" asChild className="justify-start">
                    <Link href="/admin/orders"><CreditCard className="mr-2 h-4 w-4" />{t('common.ordersRefunds')}</Link>
                </Button>
            </nav>
            <div className="mt-auto pt-6 border-t">
                <div className="px-2 text-sm text-muted-foreground mb-4">
                    {t('common.loggedInAs')} <br /> <strong className="text-foreground">{username}</strong>
                </div>
                <Button
                    variant="outline"
                    className="w-full justify-start text-muted-foreground"
                    onClick={() => signOut({ callbackUrl: "/" })}
                >
                    <LogOut className="mr-2 h-4 w-4" />{t('common.logout')}
                </Button>
            </div>
        </aside>
    )
}
