import { db } from "./index";
import { products, cards, orders } from "./schema";
import { eq, sql, desc, and, asc, gte } from "drizzle-orm";

export async function getProducts() {
    return await db.select({
        id: products.id,
        name: products.name,
        description: products.description,
        price: products.price,
        image: products.image,
        category: products.category,
        isActive: products.isActive,
        sortOrder: products.sortOrder,
        stock: sql<number>`count(case when ${cards.isUsed} = false then 1 end)::int`,
        sold: sql<number>`count(case when ${cards.isUsed} = true then 1 end)::int`
    })
        .from(products)
        .leftJoin(cards, eq(products.id, cards.productId))
        .groupBy(products.id)
        .orderBy(asc(products.sortOrder), desc(products.createdAt));
}

// Get only active products (for home page)
export async function getActiveProducts() {
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
        .where(eq(products.isActive, true))
        .groupBy(products.id)
        .orderBy(asc(products.sortOrder), desc(products.createdAt));
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

// Dashboard Stats
export async function getDashboardStats() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get all delivered orders
    const allOrders = await db.query.orders.findMany({
        where: eq(orders.status, 'delivered')
    });

    const todayOrders = allOrders.filter(o => o.paidAt && new Date(o.paidAt) >= todayStart);
    const weekOrders = allOrders.filter(o => o.paidAt && new Date(o.paidAt) >= weekStart);
    const monthOrders = allOrders.filter(o => o.paidAt && new Date(o.paidAt) >= monthStart);

    const sumAmount = (orders: typeof allOrders) =>
        orders.reduce((sum, o) => sum + parseFloat(o.amount), 0);

    return {
        today: { count: todayOrders.length, revenue: sumAmount(todayOrders) },
        week: { count: weekOrders.length, revenue: sumAmount(weekOrders) },
        month: { count: monthOrders.length, revenue: sumAmount(monthOrders) },
        total: { count: allOrders.length, revenue: sumAmount(allOrders) }
    };
}

