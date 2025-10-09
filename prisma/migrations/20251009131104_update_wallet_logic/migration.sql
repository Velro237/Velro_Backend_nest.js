/*
  Warnings:

  - The values [TRIP_EARNING,WITHDRAW,REFUND,FEE] on the enum `TransactionType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `amount` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `walletId` on the `Transaction` table. All the data in the column will be lost.
  - Added the required column `amount_paid` to the `Transaction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `amount_requested` to the `Transaction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `currency` to the `Transaction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fee_applied` to the `Transaction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `source` to the `Transaction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `wallet_id` to the `Transaction` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."TransactionSource" AS ENUM ('TRIP_EARNING', 'WITHDRAW', 'REFUND', 'FEE');

-- AlterEnum
BEGIN;
CREATE TYPE "public"."TransactionType_new" AS ENUM ('CREDIT', 'DEBIT');
ALTER TABLE "public"."Transaction" ALTER COLUMN "type" TYPE "public"."TransactionType_new" USING ("type"::text::"public"."TransactionType_new");
ALTER TYPE "public"."TransactionType" RENAME TO "TransactionType_old";
ALTER TYPE "public"."TransactionType_new" RENAME TO "TransactionType";
DROP TYPE "public"."TransactionType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "public"."Transaction" DROP CONSTRAINT "Transaction_walletId_fkey";

-- AlterTable
ALTER TABLE "public"."Transaction" DROP COLUMN "amount",
DROP COLUMN "walletId",
ADD COLUMN     "amount_paid" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "amount_requested" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "balanceAfter" DECIMAL(10,2),
ADD COLUMN     "currency" TEXT NOT NULL,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "fee_applied" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "processedAt" TIMESTAMP(3),
ADD COLUMN     "source" "public"."TransactionSource" NOT NULL,
ADD COLUMN     "status_message" TEXT,
ADD COLUMN     "wallet_id" TEXT NOT NULL,
ALTER COLUMN "reference" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."Wallet" ADD COLUMN     "wallet_status_message" TEXT;

-- CreateIndex
CREATE INDEX "Transaction_userId_createdAt_idx" ON "public"."Transaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Transaction_reference_idx" ON "public"."Transaction"("reference");

-- CreateIndex
CREATE INDEX "Wallet_userId_idx" ON "public"."Wallet"("userId");

-- AddForeignKey
ALTER TABLE "public"."Transaction" ADD CONSTRAINT "Transaction_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "public"."Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
