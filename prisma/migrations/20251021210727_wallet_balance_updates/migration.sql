-- AlterTable
ALTER TABLE "public"."Wallet" ADD COLUMN     "available_balance_cad" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "available_balance_eur" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "available_balance_usd" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "available_balance_xaf" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "hold_balance_cad" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "hold_balance_eur" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "hold_balance_usd" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "hold_balance_xaf" DECIMAL(10,2) NOT NULL DEFAULT 0;
