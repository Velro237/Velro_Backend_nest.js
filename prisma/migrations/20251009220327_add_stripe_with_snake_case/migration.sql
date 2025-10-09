-- DropIndex
DROP INDEX "public"."Transaction_stripeTransferId_idx";

-- DropIndex
DROP INDEX "public"."Transaction_stripeTransferId_key";

-- DropIndex
DROP INDEX "public"."TripRequest_paymentIntentId_key";

-- DropIndex
DROP INDEX "public"."User_stripeAccountId_key";

-- AlterTable
ALTER TABLE "public"."Transaction" DROP COLUMN "stripeAccountId",
DROP COLUMN "stripeTransferId",
ADD COLUMN     "stripe_account_id" TEXT,
ADD COLUMN     "stripe_transfer_id" TEXT;

-- AlterTable
ALTER TABLE "public"."TripRequest" DROP COLUMN "amountGross",
DROP COLUMN "deliveredAt",
DROP COLUMN "paidAt",
DROP COLUMN "paymentIntentId",
DROP COLUMN "paymentStatus",
DROP COLUMN "senderConfirmedDelivery",
DROP COLUMN "travelerConfirmedDelivery",
ADD COLUMN     "delivered_at" TIMESTAMP(3),
ADD COLUMN     "paid_at" TIMESTAMP(3),
ADD COLUMN     "payment_intent_id" TEXT,
ADD COLUMN     "payment_status" "public"."PaymentStatus" DEFAULT 'PENDING',
ADD COLUMN     "sender_confirmed_delivery" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "traveler_confirmed_delivery" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "payoutCountry",
DROP COLUMN "payoutCurrency",
DROP COLUMN "stripeAccountId",
DROP COLUMN "stripeOnboardingComplete",
DROP COLUMN "transfersCapability",
ADD COLUMN     "payout_country" TEXT,
ADD COLUMN     "payout_currency" TEXT DEFAULT 'EUR',
ADD COLUMN     "stripe_account_id" TEXT,
ADD COLUMN     "stripe_onboarding_complete" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "transfers_capability" TEXT DEFAULT 'inactive';

-- AlterTable
ALTER TABLE "public"."Wallet" DROP COLUMN "availableBalance",
DROP COLUMN "pendingBalance",
DROP COLUMN "withdrawnTotal",
ADD COLUMN     "available_balance_stripe" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "pending_balance_stripe" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "withdrawn_total_stripe" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_stripe_transfer_id_key" ON "public"."Transaction"("stripe_transfer_id");

-- CreateIndex
CREATE INDEX "Transaction_stripe_transfer_id_idx" ON "public"."Transaction"("stripe_transfer_id");

-- CreateIndex
CREATE UNIQUE INDEX "TripRequest_payment_intent_id_key" ON "public"."TripRequest"("payment_intent_id");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripe_account_id_key" ON "public"."User"("stripe_account_id");

