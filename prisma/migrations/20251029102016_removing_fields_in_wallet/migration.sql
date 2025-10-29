/*
  Warnings:

  - You are about to drop the column `available_balance_stripe` on the `Wallet` table. All the data in the column will be lost.
  - You are about to drop the column `pending_balance_stripe` on the `Wallet` table. All the data in the column will be lost.
  - You are about to drop the column `withdrawn_total_stripe` on the `Wallet` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Wallet" DROP COLUMN "available_balance_stripe",
DROP COLUMN "pending_balance_stripe",
DROP COLUMN "withdrawn_total_stripe";
