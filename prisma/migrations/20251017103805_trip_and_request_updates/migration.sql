/*
  Warnings:

  - The values [FULLY_BOOKED] on the enum `TripStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."RequestStatus" ADD VALUE 'AWAITING_PAYMENT';
ALTER TYPE "public"."RequestStatus" ADD VALUE 'REFUNDED';

-- AlterEnum
BEGIN;
CREATE TYPE "public"."TripStatus_new" AS ENUM ('PUBLISHED', 'SCHEDULED', 'RESCHEDULED', 'CANCELLED', 'COMPLETED', 'DRAFT');
ALTER TABLE "public"."Trip" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "public"."Trip" ALTER COLUMN "status" TYPE "public"."TripStatus_new" USING ("status"::text::"public"."TripStatus_new");
ALTER TYPE "public"."TripStatus" RENAME TO "TripStatus_old";
ALTER TYPE "public"."TripStatus_new" RENAME TO "TripStatus";
DROP TYPE "public"."TripStatus_old";
ALTER TABLE "public"."Trip" ALTER COLUMN "status" SET DEFAULT 'SCHEDULED';
COMMIT;

-- AlterTable
ALTER TABLE "public"."Trip" ADD COLUMN     "fully_booked" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "status" SET DEFAULT 'SCHEDULED';
