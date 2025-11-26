-- AlterEnum
-- This migration adds more status values to RideTripStatus enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.

ALTER TYPE "public"."RideTripStatus" ADD VALUE 'SCHEDULED';
ALTER TYPE "public"."RideTripStatus" ADD VALUE 'IN_PROGRESS';
ALTER TYPE "public"."RideTripStatus" ADD VALUE 'COMPLETED';
ALTER TYPE "public"."RideTripStatus" ADD VALUE 'RESCHEDULED';

