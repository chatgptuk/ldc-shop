import { pgTable, text, decimal, boolean, timestamp, serial, integer, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Products
export const products = pgTable('products', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    price: decimal('price', { precision: 10, scale: 2 }).notNull(),
    compareAtPrice: decimal('compare_at_price', { precision: 10, scale: 2 }),
    maxPointsDiscount: decimal('max_points_discount', { precision: 10, scale: 2 }),
    category: text('category'),
    image: text('image'),
    isHot: boolean('is_hot').default(false),
    isActive: boolean('is_active').default(true),
    sortOrder: integer('sort_order').default(0),
    purchaseLimit: integer('purchase_limit'),
    createdAt: timestamp('created_at').defaultNow(),
});

// Cards (Stock)
export const cards = pgTable('cards', {
    id: serial('id').primaryKey(),
    productId: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
    cardKey: text('card_key').notNull(),
    isUsed: boolean('is_used').default(false),
    reservedOrderId: text('reserved_order_id'),
    reservedAt: timestamp('reserved_at'),
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
    payee: text('payee'),
    pointsUsed: integer('points_used').default(0),
    quantity: integer('quantity').default(1).notNull(),
    currentPaymentId: text('current_payment_id'),
    createdAt: timestamp('created_at').defaultNow(),
});

// Logged-in users (for visitor counts)
export const loginUsers = pgTable('login_users', {
    userId: text('user_id').primaryKey(),
    username: text('username'),
    points: integer('points').default(0).notNull(),
    isBlocked: boolean('is_blocked').default(false),
    createdAt: timestamp('created_at').defaultNow(),
    lastLoginAt: timestamp('last_login_at').defaultNow(),
});

// Daily Check-ins
export const dailyCheckins = pgTable('daily_checkins', {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull().references(() => loginUsers.userId, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({
    userDateUnique: uniqueIndex('daily_checkins_user_date_unique').on(t.userId, sql`date(${t.createdAt})`),
}));

// NextAuth Tables (Optional, if using adapter)
/* 
   We will likely manage users via NextAuth standard schema if we use the adapter, 
   but for now we are replicating the Shop logic. 
   OIDC user info can be stored in session or a simple users table if needed.
*/

// Settings (for announcements and global config)
export const settings = pgTable('settings', {
    key: text('key').primaryKey(),
    value: text('value'),
    updatedAt: timestamp('updated_at').defaultNow(),
});

// Reviews
export const reviews = pgTable('reviews', {
    id: serial('id').primaryKey(),
    productId: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
    orderId: text('order_id').notNull(),
    userId: text('user_id').notNull(),
    username: text('username').notNull(),
    rating: integer('rating').notNull(), // 1-5 stars
    comment: text('comment'),
    createdAt: timestamp('created_at').defaultNow(),
});

// Categories (optional taxonomy)
export const categories = pgTable('categories', {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    icon: text('icon'),
    sortOrder: integer('sort_order').default(0),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
});

// Refund requests
export const refundRequests = pgTable('refund_requests', {
    id: serial('id').primaryKey(),
    orderId: text('order_id').notNull(),
    userId: text('user_id'),
    username: text('username'),
    reason: text('reason'),
    status: text('status').default('pending'), // pending, approved, rejected, processed
    adminUsername: text('admin_username'),
    adminNote: text('admin_note'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
    processedAt: timestamp('processed_at'),
});
