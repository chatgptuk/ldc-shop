"use client"

import { signOut } from "next-auth/react"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"

export function SignOutButton() {
    return (
        <DropdownMenuItem
            onClick={() => signOut({ callbackUrl: "/" })}
            className="cursor-pointer"
        >
            Log out
        </DropdownMenuItem>
    )
}
