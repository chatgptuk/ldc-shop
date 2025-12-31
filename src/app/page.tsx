import Link from "next/link";
import { getProducts } from "@/lib/db/queries";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const dynamic = 'force-dynamic';

export default async function Home() {
  let products = [];
  try {
    products = await getProducts();
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
      `);

      products = await getProducts();
    } else {
      throw error;
    }
  }

  return (
    <main className="container py-8 md:py-12">
      <section className="mb-12 space-y-4 text-center">
        <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent pb-2">
          LDC Shop
        </h1>
        <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl">
          High-quality virtual goods, instant delivery.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {products.map((product) => (
          <Card key={product.id} className="overflow-hidden flex flex-col hover:shadow-lg transition-shadow">
            <div className="aspect-square relative bg-muted/20 p-6 flex items-center justify-center">
              <img
                src={product.image || `https://api.dicebear.com/7.x/shapes/svg?seed=${product.id}`}
                alt={product.name}
                className="w-full h-full object-contain transition-transform hover:scale-105 duration-300"
              />
              {product.category && product.category !== 'general' && (
                <Badge variant="secondary" className="absolute top-2 right-2 capitalize">
                  {product.category}
                </Badge>
              )}
            </div>
            <CardContent className="grid gap-2.5 p-6">
              <h3 className="line-clamp-1 font-semibold text-lg">{product.name}</h3>
              <p className="line-clamp-2 text-sm text-muted-foreground min-h-[40px]">
                {product.description}
              </p>
              <div className="flex items-center justify-between mt-2">
                <div className="text-xl font-bold text-primary">
                  {Number(product.price)} <span className="text-xs font-normal text-muted-foreground">Credits</span>
                </div>
                <Badge variant={product.stock > 0 ? "outline" : "destructive"}>
                  {product.stock > 0 ? `${product.stock} Stock` : 'Out of Stock'}
                </Badge>
              </div>
            </CardContent>
            <CardFooter className="p-6 pt-0 mt-auto">
              <Button asChild className="w-full" disabled={product.stock <= 0}>
                <Link href={`/buy/${product.id}`}>
                  {product.stock > 0 ? "Buy Now" : "Sold Out"}
                </Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
        {products.length === 0 && (
          <div className="col-span-full text-center py-20 text-muted-foreground">
            No products available.
          </div>
        )}
      </section>
    </main>
  );
}
