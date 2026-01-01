import { db } from "./index";
import { products, cards, orders } from "./schema";
import { eq, sql, desc } from "drizzle-orm";

export async function getProducts() {
    return await db.select({
        id: products.id,
        name: products.name,
        description: products.description,
        price: products.price,
        image: products.image,
        category: products.category,
        stock: sql<number>`count(case when ${cards.isUsed} = false then 1 end)::int`,
        sold: sql<number>`count(case when ${cards.isUsed} = true then 1 end)::int`
    })
        .from(products)
        .leftJoin(cards, eq(products.id, cards.productId))
        .groupBy(products.id);
}

export async function getProduct(id: string) {
    const result = await db.select({
        id: products.id,
        name: products.name,
        description: products.description,
        price: products.price,
        image: products.image,
        category: products.category,
        stock: sql<number>`count(case when ${cards.isUsed} = false then 1 end)::int`
    })
        .from(products)
        .leftJoin(cards, eq(products.id, cards.productId))
        .where(eq(products.id, id))
        .groupBy(products.id);

    return result[0];
}
