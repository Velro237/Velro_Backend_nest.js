-- CreateEnum (IF NOT EXISTS to handle fresh database)
DO $$ BEGIN
 CREATE TYPE "public"."PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'REFUNDED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- DropIndex (IF EXISTS to handle fresh database)
DROP INDEX IF EXISTS "public"."Transaction_stripeTransferId_idx";

-- DropIndex
DROP INDEX IF EXISTS "public"."Transaction_stripeTransferId_key";

-- DropIndex
DROP INDEX IF EXISTS "public"."TripRequest_paymentIntentId_key";

-- DropIndex
DROP INDEX IF EXISTS "public"."User_stripeAccountId_key";

-- AlterTable
ALTER TABLE "public"."Transaction" 
DROP COLUMN IF EXISTS "stripeAccountId",
DROP COLUMN IF EXISTS "stripeTransferId",
ADD COLUMN IF NOT EXISTS "stripe_account_id" TEXT,
ADD COLUMN IF NOT EXISTS "stripe_transfer_id" TEXT;

-- AlterTable
ALTER TABLE "public"."TripRequest" 
DROP COLUMN IF EXISTS "amountGross",
DROP COLUMN IF EXISTS "deliveredAt",
DROP COLUMN IF EXISTS "paidAt",
DROP COLUMN IF EXISTS "paymentIntentId",
DROP COLUMN IF EXISTS "paymentStatus",
DROP COLUMN IF EXISTS "senderConfirmedDelivery",
DROP COLUMN IF EXISTS "travelerConfirmedDelivery",
ADD COLUMN IF NOT EXISTS "delivered_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "paid_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "payment_intent_id" TEXT,
ADD COLUMN IF NOT EXISTS "payment_status" "public"."PaymentStatus" DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS "sender_confirmed_delivery" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "traveler_confirmed_delivery" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."User" 
DROP COLUMN IF EXISTS "payoutCountry",
DROP COLUMN IF EXISTS "payoutCurrency",
DROP COLUMN IF EXISTS "stripeAccountId",
DROP COLUMN IF EXISTS "stripeOnboardingComplete",
DROP COLUMN IF EXISTS "transfersCapability",
ADD COLUMN IF NOT EXISTS "payout_country" TEXT,
ADD COLUMN IF NOT EXISTS "payout_currency" TEXT DEFAULT 'EUR',
ADD COLUMN IF NOT EXISTS "stripe_account_id" TEXT,
ADD COLUMN IF NOT EXISTS "stripe_onboarding_complete" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "transfers_capability" TEXT DEFAULT 'inactive';

-- AlterTable
ALTER TABLE "public"."Wallet" 
DROP COLUMN IF EXISTS "availableBalance",
DROP COLUMN IF EXISTS "pendingBalance",
DROP COLUMN IF EXISTS "withdrawnTotal",
ADD COLUMN IF NOT EXISTS "available_balance_stripe" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "pending_balance_stripe" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "withdrawn_total_stripe" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Transaction_stripe_transfer_id_key" ON "public"."Transaction"("stripe_transfer_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Transaction_stripe_transfer_id_idx" ON "public"."Transaction"("stripe_transfer_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "TripRequest_payment_intent_id_key" ON "public"."TripRequest"("payment_intent_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_stripe_account_id_key" ON "public"."User"("stripe_account_id");

