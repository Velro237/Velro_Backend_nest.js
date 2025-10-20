/*
  Warnings:

  - You are about to drop the column `request_id` on the `Chat` table. All the data in the column will be lost.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."TransactionSource" ADD VALUE 'CANCELLATION_COMPENSATION';
ALTER TYPE "public"."TransactionSource" ADD VALUE 'VELRO_FEE';
ALTER TYPE "public"."TransactionSource" ADD VALUE 'PAYMENT_CANCELLATION';

-- DropForeignKey
ALTER TABLE "public"."Chat" DROP CONSTRAINT "Chat_request_id_fkey";

-- AlterTable
ALTER TABLE "public"."Chat" DROP COLUMN "request_id";

-- AlterTable
ALTER TABLE "public"."TripRequest" ADD COLUMN     "cancellation_reason" TEXT,
ADD COLUMN     "cancellation_type" TEXT;
