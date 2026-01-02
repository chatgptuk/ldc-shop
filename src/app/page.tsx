import { getActiveProducts } from "@/lib/db/queries";
import { HomeContent } from "@/components/home-content";

export const dynamic = 'force-dynamic';

export default async function Home() {
  let products: any[] = [];
  try {
    products = await getActiveProducts();
  } catch (error: any) {
    const errorString = JSON.stringify(error);
    const isTableMissing =
      error.message?.includes('does not exist') ||
      error.cause?.message?.includes('does not exist') ||
      errorString.includes('42P01') || // PostgreSQL error code for undefined_table
      errorString.includes('relation') && errorString.includes('does not exist');

    if (isTableMissing) {
      console.log("Database initialized check: Table missing. Running inline migrations...");
      const { db } = await import("@/lib/db");
      const { sql } = await import("drizzle-orm");

      await db.execute(sql`
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
        -- Add columns if missing (for existing databases)
        ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
      `);

      products = await getActiveProducts();
    } else {
      throw error;
    }
  }

  return <HomeContent products={products.map(p => ({
    ...p,
    stockCount: p.stock,
    soldCount: p.sold || 0
  }))} />;
}
