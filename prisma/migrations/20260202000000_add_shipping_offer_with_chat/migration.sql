-- AlterEnum: Add OFFER_ACCEPTED to ShippingRequestStatus (skip if already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'ShippingRequestStatus' AND e.enumlabel = 'OFFER_ACCEPTED'
  ) THEN
    ALTER TYPE "ShippingRequestStatus" ADD VALUE 'OFFER_ACCEPTED' BEFORE 'BOOKED';
  END IF;
END
$$;

-- CreateTable: Create ShippingOffer table
CREATE TABLE IF NOT EXISTS "ShippingOffer" (
    "id" TEXT NOT NULL,
    "shipping_request_id" TEXT NOT NULL,
    "traveler_id" TEXT NOT NULL,
    "reward_amount" DECIMAL(65,30) NOT NULL,
    "travel_date" TIMESTAMP(3),
    "message" TEXT,
    "chat_id" TEXT,
    "status" "OfferStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),

    CONSTRAINT "ShippingOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Unique constraint on chat_id
CREATE UNIQUE INDEX IF NOT EXISTS "ShippingOffer_chat_id_key" ON "ShippingOffer"("chat_id");

-- CreateIndex: Performance indexes
CREATE INDEX IF NOT EXISTS "ShippingOffer_shipping_request_id_idx" ON "ShippingOffer"("shipping_request_id");
CREATE INDEX IF NOT EXISTS "ShippingOffer_traveler_id_idx" ON "ShippingOffer"("traveler_id");
CREATE INDEX IF NOT EXISTS "ShippingOffer_status_idx" ON "ShippingOffer"("status");
CREATE INDEX IF NOT EXISTS "ShippingOffer_chat_id_idx" ON "ShippingOffer"("chat_id");

-- AddForeignKey: Link ShippingOffer to ShippingRequest (skip if already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ShippingOffer_shipping_request_id_fkey'
  ) THEN
    ALTER TABLE "ShippingOffer" ADD CONSTRAINT "ShippingOffer_shipping_request_id_fkey" FOREIGN KEY ("shipping_request_id") REFERENCES "ShippingRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

-- AddForeignKey: Link ShippingOffer to User (traveler) (skip if already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ShippingOffer_traveler_id_fkey'
  ) THEN
    ALTER TABLE "ShippingOffer" ADD CONSTRAINT "ShippingOffer_traveler_id_fkey" FOREIGN KEY ("traveler_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

-- AddForeignKey: Link ShippingOffer to Chat (skip if already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ShippingOffer_chat_id_fkey'
  ) THEN
    ALTER TABLE "ShippingOffer" ADD CONSTRAINT "ShippingOffer_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "Chat"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;
