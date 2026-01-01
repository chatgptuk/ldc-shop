'use server'

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { products, cards } from "@/lib/db/schema"
import { eq, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"

// Check Admin Helper
// Check Admin Helper
export async function checkAdmin() {
    const session = await auth()
    const user = session?.user
    const adminUsers = process.env.ADMIN_USERS?.toLowerCase().split(',') || []
    if (!user || !user.username || !adminUsers.includes(user.username.toLowerCase())) {
        throw new Error("Unauthorized")
    }
}

export async function saveProduct(formData: FormData) {
    await checkAdmin()

    const id = formData.get('id') as string || `prod_${Date.now()}`
    const name = formData.get('name') as string
    const description = formData.get('description') as string
    const price = formData.get('price') as string
    const category = formData.get('category') as string
    const image = formData.get('image') as string

    await db.insert(products).values({
        id, name, description, price, category, image
    }).onConflictDoUpdate({
        target: products.id,
        set: { name, description, price, category, image }
    })

    revalidatePath('/admin')
    revalidatePath('/')
}

export async function deleteProduct(id: string) {
    await checkAdmin()
    await db.delete(products).where(eq(products.id, id))
    revalidatePath('/admin')
    revalidatePath('/')
}

export async function addCards(formData: FormData) {
    await checkAdmin()
    const productId = formData.get('product_id') as string
    const rawCards = formData.get('cards') as string

    const cardList = rawCards.split('\n').map(c => c.trim()).filter(c => c)
    if (cardList.length === 0) return

    await db.insert(cards).values(
        cardList.map(key => ({
            productId,
            cardKey: key
        }))
    )

    revalidatePath('/admin')
    revalidatePath('/')
}
