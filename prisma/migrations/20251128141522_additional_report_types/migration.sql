/*
  Warnings:

  - Made the column `departure_location` on table `RideTrip` required. This step will fail if there are existing NULL values in that column.
  - Made the column `arrival_location` on table `RideTrip` required. This step will fail if there are existing NULL values in that column.
  - Made the column `stop_location` on table `RideTripStop` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."ReportType" ADD VALUE 'COMMUNICATION_PROBLEM';
ALTER TYPE "public"."ReportType" ADD VALUE 'PACKAGE_ISSUE';
ALTER TYPE "public"."ReportType" ADD VALUE 'PAYMENT_PROBLEM';
ALTER TYPE "public"."ReportType" ADD VALUE 'POLICY_VIOLATION';
ALTER TYPE "public"."ReportType" ADD VALUE 'APP_TECHNICAL';

-- AlterTable
ALTER TABLE "public"."RideTrip" ALTER COLUMN "departure_location" SET NOT NULL,
ALTER COLUMN "arrival_location" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."RideTripStop" ALTER COLUMN "stop_location" SET NOT NULL;
