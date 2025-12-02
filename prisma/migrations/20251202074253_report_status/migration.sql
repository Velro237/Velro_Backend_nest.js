/*
  Warnings:

  - The values [TRAVEL_ISSUES,OTHER_ISSUES] on the enum `ReportType` will be removed. If these variants are still used in the database, this will fail.

*/
-- First, update any existing records that use the old enum values to use 'OTHER'
UPDATE "public"."Report" 
SET "type" = 'OTHER'::text 
WHERE "type" IN ('TRAVEL_ISSUES', 'OTHER_ISSUES');

-- AlterEnum
BEGIN;
CREATE TYPE "public"."ReportType_new" AS ENUM ('RESPONSE_TO_REPORT', 'COMMUNICATION_PROBLEM', 'PACKAGE_ISSUE', 'PAYMENT_PROBLEM', 'POLICY_VIOLATION', 'APP_TECHNICAL', 'DRIVER_WAS_LATE', 'UNSAFE_DRIVING', 'WRONG_ROUTE_TAKEN', 'VEHICLE_CONDITION_ISSUE', 'INAPPROPRIATE_BEHAVIOR', 'OTHER');
ALTER TABLE "public"."Report" ALTER COLUMN "type" TYPE "public"."ReportType_new" USING ("type"::text::"public"."ReportType_new");
ALTER TYPE "public"."ReportType" RENAME TO "ReportType_old";
ALTER TYPE "public"."ReportType_new" RENAME TO "ReportType";
DROP TYPE "public"."ReportType_old";
COMMIT;

-- DropIndex
DROP INDEX "public"."Report_trip_id_idx";
