import { auth } from "@/lib/auth"
import { notFound } from "next/navigation"
import { AdminSidebar } from "@/components/admin/sidebar"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const session = await auth()
    const user = session?.user

    // Admin Check
    const adminUsers = process.env.ADMIN_USERS?.toLowerCase().split(',') || []
    if (!user || !user.username || !adminUsers.includes(user.username.toLowerCase())) {
        return notFound()
    }

    return (
        <div className="flex min-h-screen flex-col md:flex-row">
            <AdminSidebar username={user.username} />
            <main className="flex-1 p-6 md:p-12 overflow-y-auto">
                {children}
            </main>
        </div>
    )
}
