"use client"

import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"

export function SignInButton() {
    return (
        <Button
            size="sm"
            onClick={() => signIn("linuxdo")}
        >
            Sign in with Linux DO
        </Button>
    )
}
