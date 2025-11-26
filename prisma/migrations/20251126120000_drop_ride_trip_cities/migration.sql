-- Drop foreign keys related to City and ride trip city columns
ALTER TABLE "public"."RideTrip"
  DROP CONSTRAINT IF EXISTS "RideTrip_departure_city_id_fkey",
  DROP CONSTRAINT IF EXISTS "RideTrip_arrival_city_id_fkey";

ALTER TABLE "public"."RideTripStop"
  DROP CONSTRAINT IF EXISTS "RideTripStop_stop_city_id_fkey";

-- Drop indexes on city id columns
DROP INDEX IF EXISTS "RideTrip_departure_city_id_idx";
DROP INDEX IF EXISTS "RideTrip_arrival_city_id_idx";
DROP INDEX IF EXISTS "RideTripStop_stop_city_id_idx";

-- Drop city id columns from RideTrip and RideTripStop
ALTER TABLE "public"."RideTrip"
  DROP COLUMN IF EXISTS "departure_city_id",
  DROP COLUMN IF EXISTS "arrival_city_id";

ALTER TABLE "public"."RideTripStop"
  DROP COLUMN IF EXISTS "stop_city_id";

-- Drop City table (no longer used)
DROP TABLE IF EXISTS "public"."City";


