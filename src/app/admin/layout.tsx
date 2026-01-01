import { auth } from "@/lib/auth"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Package, CreditCard, Users, Settings, LogOut } from "lucide-react"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const session = await auth()
    const user = session?.user

    // Admin Check
    const adminUsers = process.env.ADMIN_USERS?.toLowerCase().split(',') || []
    if (!user || !user.username || !adminUsers.includes(user.username.toLowerCase())) {
        return notFound() // or redirect to login
    }

    return (
        <div className="flex min-h-screen flex-col md:flex-row">
            <aside className="w-full md:w-64 bg-muted/40 border-r md:min-h-screen p-6 space-y-4">
                <div className="flex items-center gap-2 font-bold text-xl px-2 mb-6">
                    <span>LDC Admin</span>
                </div>
                <nav className="flex flex-col gap-2">
                    <Button variant="ghost" asChild className="justify-start">
                        <Link href="/admin"><Package className="mr-2 h-4 w-4" /> Dashboard & Products</Link>
                    </Button>
                    <Button variant="ghost" asChild className="justify-start">
                        <Link href="/admin/orders"><CreditCard className="mr-2 h-4 w-4" /> Orders & Refunds</Link>
                    </Button>
                    {/* Future: Settings, etc */}
                </nav>
                <div className="mt-auto pt-6 border-t">
                    <div className="px-2 text-sm text-muted-foreground mb-4">
                        Logged in as <br /> <strong className="text-foreground">{user.username}</strong>
                    </div>
                    <Button variant="outline" asChild className="w-full justify-start text-muted-foreground">
                        <Link href="/api/auth/signout"><LogOut className="mr-2 h-4 w-4" /> Logout</Link>
                    </Button>
                </div>
            </aside>
            <main className="flex-1 p-6 md:p-12 overflow-y-auto">
                {children}
            </main>
        </div>
    )
}
