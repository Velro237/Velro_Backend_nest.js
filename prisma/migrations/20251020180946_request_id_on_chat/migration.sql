/*
  Warnings:

  - The values [CANCELLATION_COMPENSATION,VELRO_FEE,PAYMENT_CANCELLATION] on the enum `TransactionSource` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `cancellation_reason` on the `TripRequest` table. All the data in the column will be lost.
  - You are about to drop the column `cancellation_type` on the `TripRequest` table. All the data in the column will be lost.
  - You are about to drop the column `cancelled_at` on the `TripRequest` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."TransactionSource_new" AS ENUM ('ORDER', 'WITHDRAW', 'ADJUSTMENT', 'REFUND', 'COMMISSION', 'TRIP_EARNING', 'FEE');
ALTER TABLE "public"."Transaction" ALTER COLUMN "source" TYPE "public"."TransactionSource_new" USING ("source"::text::"public"."TransactionSource_new");
ALTER TYPE "public"."TransactionSource" RENAME TO "TransactionSource_old";
ALTER TYPE "public"."TransactionSource_new" RENAME TO "TransactionSource";
DROP TYPE "public"."TransactionSource_old";
COMMIT;

-- AlterTable
ALTER TABLE "public"."Chat" ADD COLUMN     "request_id" TEXT;

-- AlterTable
ALTER TABLE "public"."TripRequest" DROP COLUMN "cancellation_reason",
DROP COLUMN "cancellation_type",
DROP COLUMN "cancelled_at";

-- AddForeignKey
ALTER TABLE "public"."Chat" ADD CONSTRAINT "Chat_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."TripRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
