-- AlterTable
ALTER TABLE "public"."Wallet" ADD COLUMN     "available_balance_stripe" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "pending_balance_stripe" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "withdrawn_total_stripe" DECIMAL(10,2) NOT NULL DEFAULT 0;
