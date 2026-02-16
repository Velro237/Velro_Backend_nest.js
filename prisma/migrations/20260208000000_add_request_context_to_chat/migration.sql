-- AlterTable (idempotent: skip if columns already exist)
ALTER TABLE "Chat" ADD COLUMN IF NOT EXISTS "shipping_request_id" TEXT;
ALTER TABLE "Chat" ADD COLUMN IF NOT EXISTS "shopping_request_id" TEXT;

-- AddForeignKey (skip if already exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Chat_shopping_request_id_fkey') THEN
    ALTER TABLE "Chat" ADD CONSTRAINT "Chat_shopping_request_id_fkey" FOREIGN KEY ("shopping_request_id") REFERENCES "ShoppingRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Chat_shipping_request_id_fkey') THEN
    ALTER TABLE "Chat" ADD CONSTRAINT "Chat_shipping_request_id_fkey" FOREIGN KEY ("shipping_request_id") REFERENCES "ShippingRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
