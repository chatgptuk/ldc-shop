import Link from "next/link"
import { auth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ShoppingBag, User } from "lucide-react"
import { SignInButton } from "@/components/signin-button"
import { SignOutButton } from "@/components/signout-button"
import { HeaderNav, HeaderUserMenuItems, LanguageSwitcher } from "@/components/header-client-parts"

export async function SiteHeader() {
    const session = await auth()
    const user = session?.user

    // Check if admin (case-insensitive)
    const adminUsers = process.env.ADMIN_USERS?.toLowerCase().split(',') || []
    const isAdmin = user?.username && adminUsers.includes(user.username.toLowerCase()) || false

    return (
        <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-16 items-center space-x-4 sm:justify-between sm:space-x-0">
                <div className="flex gap-6 md:gap-10">
                    <Link href="/" className="flex items-center gap-2 group">
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center group-hover:shadow-lg group-hover:shadow-primary/25 transition-all duration-300">
                            <ShoppingBag className="h-4 w-4 text-primary-foreground" />
                        </div>
                        <span className="text-sm font-semibold tracking-tight gradient-text">LDC</span>
                    </Link>
                    <HeaderNav isAdmin={isAdmin} />
                </div>
                <div className="flex flex-1 items-center justify-end space-x-4">
                    <nav className="flex items-center space-x-2">
                        <LanguageSwitcher />
                        {user ? (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={user.avatar_url || ''} alt={user.name || ''} />
                                            <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                                        </Avatar>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-56" align="end" forceMount>
                                    <DropdownMenuLabel className="font-normal">
                                        <div className="flex flex-col space-y-1">
                                            <p className="text-sm font-medium leading-none">{user.name}</p>
                                            <p className="text-xs leading-none text-muted-foreground">ID: {user.id}</p>
                                        </div>
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <HeaderUserMenuItems isAdmin={isAdmin} />
                                    <DropdownMenuSeparator />
                                    <SignOutButton />
                                </DropdownMenuContent>
                            </DropdownMenu>
                        ) : (
                            <SignInButton />
                        )}
                    </nav>
                </div>
            </div>
        </header>
    )
}
