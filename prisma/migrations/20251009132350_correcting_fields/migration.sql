/*
  Warnings:

  - You are about to drop the column `balanceAfter` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `wallet_status_message` on the `Wallet` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Transaction" DROP COLUMN "balanceAfter",
ADD COLUMN     "balance_after" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "public"."Wallet" DROP COLUMN "wallet_status_message",
ADD COLUMN     "status_message" TEXT;
