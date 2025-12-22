-- Fix ReportType enum by removing TRAVEL_ISSUES and OTHER_ISSUES
-- First, update any records that still have these old enum values to 'OTHER'

-- Step 1: Update all TRAVEL_ISSUES records to OTHER
UPDATE "public"."Report"
SET "type" = 'OTHER'::"public"."ReportType"
WHERE "type"::text = 'TRAVEL_ISSUES';

-- Step 2: Update all OTHER_ISSUES records to OTHER
UPDATE "public"."Report"
SET "type" = 'OTHER'::"public"."ReportType"
WHERE "type"::text = 'OTHER_ISSUES';

-- Step 3: Recreate the enum without TRAVEL_ISSUES and OTHER_ISSUES
-- This is necessary because PostgreSQL doesn't support removing enum values directly
BEGIN;
CREATE TYPE "public"."ReportType_new" AS ENUM (
  'RESPONSE_TO_REPORT',
  'COMMUNICATION_PROBLEM',
  'PACKAGE_ISSUE',
  'PACKAGE_LOST',
  'PAYMENT_PROBLEM',
  'POLICY_VIOLATION',
  'DELAYED_DEPARTURE',
  'APP_TECHNICAL',
  'DRIVER_WAS_LATE',
  'UNSAFE_DRIVING',
  'WRONG_ROUTE_TAKEN',
  'VEHICLE_CONDITION_ISSUE',
  'INAPPROPRIATE_BEHAVIOR',
  'OTHER'
);

-- Convert all columns using the old enum to use the new one
ALTER TABLE "public"."Report" ALTER COLUMN "type" TYPE "public"."ReportType_new" USING ("type"::text::"public"."ReportType_new");

-- Drop the old enum and rename the new one
DROP TYPE "public"."ReportType";
ALTER TYPE "public"."ReportType_new" RENAME TO "ReportType";
COMMIT;

-- Step 4: Handle the trip_id index
-- The migration 20251202074253_report_status dropped this index, but it exists in the database
-- We'll keep it since it's useful for queries
CREATE INDEX IF NOT EXISTS "Report_trip_id_idx" ON "public"."Report"("trip_id");

