-- AlterEnum: Add SHOPPING to ChatType (skip if already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'ChatType' AND e.enumlabel = 'SHOPPING'
  ) THEN
    ALTER TYPE "ChatType" ADD VALUE 'SHOPPING';
  END IF;
END
$$;

-- AlterTable: Add chat_id to Offer table (skip if already exists)
ALTER TABLE "Offer" ADD COLUMN IF NOT EXISTS "chat_id" TEXT;

-- CreateIndex: Add unique constraint on chat_id in Offer
CREATE UNIQUE INDEX IF NOT EXISTS "Offer_chat_id_key" ON "Offer"("chat_id");

-- CreateIndex: Add index on chat_id in Offer for performance
CREATE INDEX IF NOT EXISTS "Offer_chat_id_idx" ON "Offer"("chat_id");

-- AddForeignKey: Link Offer.chat_id to Chat.id (skip if already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Offer_chat_id_fkey'
  ) THEN
    ALTER TABLE "Offer" ADD CONSTRAINT "Offer_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "Chat"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

-- Data Migration: Move existing chats from ShoppingRequest to their accepted Offers
-- Only run if ShoppingRequest still has chat_id (skip if column was already dropped)
DO $$
DECLARE
    shopping_req RECORD;
    accepted_offer_id TEXT;
    has_chat_id_col BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'ShoppingRequest' AND column_name = 'chat_id'
    ) INTO has_chat_id_col;

    IF has_chat_id_col THEN
        FOR shopping_req IN 
            SELECT id, chat_id 
            FROM "ShoppingRequest" 
            WHERE chat_id IS NOT NULL
        LOOP
            -- Find the accepted offer for this shopping request
            SELECT id INTO accepted_offer_id
            FROM "Offer"
            WHERE shopping_request_id = shopping_req.id
              AND status = 'ACCEPTED'
            LIMIT 1;
            
            -- If an accepted offer exists, move the chat to it
            IF accepted_offer_id IS NOT NULL THEN
                UPDATE "Offer"
                SET chat_id = shopping_req.chat_id
                WHERE id = accepted_offer_id;
            ELSE
                -- If no accepted offer, link chat to the first offer (for backward compatibility)
                SELECT id INTO accepted_offer_id
                FROM "Offer"
                WHERE shopping_request_id = shopping_req.id
                ORDER BY created_at ASC
                LIMIT 1;
                
                IF accepted_offer_id IS NOT NULL THEN
                    UPDATE "Offer"
                    SET chat_id = shopping_req.chat_id
                    WHERE id = accepted_offer_id;
                END IF;
            END IF;
        END LOOP;
    END IF;
END $$;

-- DropForeignKey: Remove foreign key constraint from ShoppingRequest to Chat
ALTER TABLE "ShoppingRequest" DROP CONSTRAINT IF EXISTS "ShoppingRequest_chat_id_fkey";

-- DropIndex: Remove unique index on chat_id in ShoppingRequest
DROP INDEX IF EXISTS "ShoppingRequest_chat_id_key";

-- AlterTable: Remove chat_id column from ShoppingRequest (skip if already dropped)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ShoppingRequest' AND column_name = 'chat_id'
  ) THEN
    ALTER TABLE "ShoppingRequest" DROP COLUMN "chat_id";
  END IF;
END
$$;
