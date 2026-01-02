import { pgTable, text, decimal, boolean, timestamp, serial, integer } from 'drizzle-orm/pg-core';

// Products
export const products = pgTable('products', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    price: decimal('price', { precision: 10, scale: 2 }).notNull(),
    category: text('category'),
    image: text('image'),
    isActive: boolean('is_active').default(true),
    sortOrder: integer('sort_order').default(0),
    createdAt: timestamp('created_at').defaultNow(),
});

// Cards (Stock)
export const cards = pgTable('cards', {
    id: serial('id').primaryKey(),
    productId: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
    cardKey: text('card_key').notNull(),
    isUsed: boolean('is_used').default(false),
    usedAt: timestamp('used_at'),
    createdAt: timestamp('created_at').defaultNow(),
});

// Orders
export const orders = pgTable('orders', {
    orderId: text('order_id').primaryKey(),
    productId: text('product_id').notNull(),
    productName: text('product_name').notNull(),
    amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
    email: text('email'),
    status: text('status').default('pending'), // pending, paid, delivered, failed, refunded
    tradeNo: text('trade_no'),
    cardKey: text('card_key'),
    paidAt: timestamp('paid_at'),
    deliveredAt: timestamp('delivered_at'),
    userId: text('user_id'), // Changed to text to align with NextAuth IDs usually
    username: text('username'),
    createdAt: timestamp('created_at').defaultNow(),
});

// NextAuth Tables (Optional, if using adapter)
/* 
   We will likely manage users via NextAuth standard schema if we use the adapter, 
   but for now we are replicating the Shop logic. 
   OIDC user info can be stored in session or a simple users table if needed.
*/
