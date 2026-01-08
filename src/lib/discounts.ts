import { db } from "@/lib/db"
import { discountCodes } from "@/lib/db/schema"
import { eq, sql } from "drizzle-orm"

export function normalizeDiscountCode(raw: string) {
  return String(raw || '').trim().toUpperCase()
}

export async function ensureDiscountCodesTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS discount_codes (
      code TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      value DECIMAL(10, 2) NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      max_uses INTEGER,
      used_count INTEGER DEFAULT 0 NOT NULL,
      min_amount DECIMAL(10, 2),
      starts_at TIMESTAMP,
      ends_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    -- Fix columns if they exist with wrong names (camelCase -> snake_case)
    DO $$ 
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='discount_codes' AND column_name='max_uses') THEN
        ALTER TABLE discount_codes ADD COLUMN max_uses INTEGER;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='discount_codes' AND column_name='used_count') THEN
        ALTER TABLE discount_codes ADD COLUMN used_count INTEGER DEFAULT 0 NOT NULL;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='discount_codes' AND column_name='min_amount') THEN
        ALTER TABLE discount_codes ADD COLUMN min_amount DECIMAL(10, 2);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='discount_codes' AND column_name='starts_at') THEN
        ALTER TABLE discount_codes ADD COLUMN starts_at TIMESTAMP;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='discount_codes' AND column_name='ends_at') THEN
        ALTER TABLE discount_codes ADD COLUMN ends_at TIMESTAMP;
      END IF;
    END $$;
    CREATE INDEX IF NOT EXISTS discount_codes_active_idx ON discount_codes(is_active);
  `)
}

export async function incrementDiscountUseBestEffort(codeRaw: string) {
  const code = normalizeDiscountCode(codeRaw)
  if (!code) return

  try {
    await ensureDiscountCodesTable()
  } catch {
    return
  }

  try {
    await db.update(discountCodes)
      .set({ usedCount: sql`${discountCodes.usedCount} + 1`, updatedAt: new Date() })
      .where(eq(discountCodes.code, code))
  } catch {
    // ignore
  }
}
