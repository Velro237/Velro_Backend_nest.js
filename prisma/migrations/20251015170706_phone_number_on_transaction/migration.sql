/*
  Warnings:

  - The values [WITHDRAWAL] on the enum `TransactionSource` will be removed. If these variants are still used in the database, this will fail.

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
ALTER TABLE "public"."Transaction" ADD COLUMN     "phone_number" TEXT;
