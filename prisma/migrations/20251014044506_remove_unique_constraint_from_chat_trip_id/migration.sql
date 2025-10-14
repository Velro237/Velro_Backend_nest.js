-- AlterEnum
ALTER TYPE "public"."PaymentStatus" ADD VALUE 'DISPUTED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."TransactionSource" ADD VALUE 'ORDER';
ALTER TYPE "public"."TransactionSource" ADD VALUE 'WITHDRAWAL';
ALTER TYPE "public"."TransactionSource" ADD VALUE 'ADJUSTMENT';
ALTER TYPE "public"."TransactionSource" ADD VALUE 'COMMISSION';

-- DropIndex
DROP INDEX "public"."Chat_trip_id_key";

-- AddForeignKey
ALTER TABLE "public"."Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
