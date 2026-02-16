-- Migration: add shopping_request_id to Rating table (idempotent)
-- Timestamp: 1771227190619

-- Add shopping_request_id column (nullable, skip if already exists)
ALTER TABLE "Rating" ADD COLUMN IF NOT EXISTS "shopping_request_id" TEXT;

-- Add foreign key constraint (skip if already exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Rating_shopping_request_id_fkey') THEN
    ALTER TABLE "Rating" ADD CONSTRAINT "Rating_shopping_request_id_fkey"
      FOREIGN KEY ("shopping_request_id") REFERENCES "ShoppingRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

-- Create index for performance
CREATE INDEX IF NOT EXISTS "Rating_shopping_request_id_idx" ON "Rating"("shopping_request_id");
