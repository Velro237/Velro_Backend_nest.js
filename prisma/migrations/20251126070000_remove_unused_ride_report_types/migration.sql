-- Remove unused report types that were added for ride trips but not used in frontend
-- PostgreSQL doesn't support removing enum values directly, so we need to recreate the enum
-- Since these values were just added and likely not used, we can safely recreate

-- Step 1: Create new enum without the unused values
CREATE TYPE "public"."ReportType_new" AS ENUM (
  'TRAVEL_ISSUES',
  'OTHER_ISSUES',
  'RESPONSE_TO_REPORT',
  'DRIVER_WAS_LATE',
  'UNSAFE_DRIVING',
  'WRONG_ROUTE_TAKEN',
  'VEHICLE_CONDITION_ISSUE',
  'INAPPROPRIATE_BEHAVIOR',
  'OTHER'
);

-- Step 2: Update all columns using the old enum to use the new one
ALTER TABLE "public"."Report" ALTER COLUMN "type" TYPE "public"."ReportType_new" USING "type"::text::"public"."ReportType_new";
ALTER TABLE "public"."RideTripReport" ALTER COLUMN "type" TYPE "public"."ReportType_new" USING "type"::text::"public"."ReportType_new";

-- Step 3: Drop the old enum
DROP TYPE "public"."ReportType";

-- Step 4: Rename the new enum to the original name
ALTER TYPE "public"."ReportType_new" RENAME TO "ReportType";

