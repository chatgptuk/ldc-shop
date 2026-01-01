"use client"

import { signOut } from "next-auth/react"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { useI18n } from "@/lib/i18n/context"

export function SignOutButton() {
    const { t } = useI18n()

    return (
        <DropdownMenuItem
            onClick={() => signOut({ callbackUrl: "/" })}
            className="cursor-pointer"
        >
            {t('common.logout')}
        </DropdownMenuItem>
    )
}
