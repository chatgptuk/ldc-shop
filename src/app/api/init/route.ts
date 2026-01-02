import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        // Run schema migrations directly
        await db.execute(sql`
            -- Create tables if not exist
            CREATE TABLE IF NOT EXISTS products (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                price DECIMAL(10, 2) NOT NULL,
                category TEXT,
                image TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS cards (
                id SERIAL PRIMARY KEY,
                product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
                card_key TEXT NOT NULL,
                is_used BOOLEAN DEFAULT FALSE,
                used_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS orders (
                order_id TEXT PRIMARY KEY,
                product_id TEXT NOT NULL,
                product_name TEXT NOT NULL,
                amount DECIMAL(10, 2) NOT NULL,
                email TEXT,
                status TEXT DEFAULT 'pending',
                trade_no TEXT,
                card_key TEXT,
                paid_at TIMESTAMP,
                delivered_at TIMESTAMP,
                user_id TEXT,
                username TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );
            
            -- Add missing columns for existing databases
            ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
        `);

        return NextResponse.json({ success: true, message: "Database initialized successfully" });
    } catch (error: any) {
        console.error(error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

