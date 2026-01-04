-- DropIndex
DROP INDEX "public"."Report_trip_id_idx";

-- AlterTable
ALTER TABLE "public"."PendingUser" ADD COLUMN     "country" TEXT;

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "country" TEXT;
