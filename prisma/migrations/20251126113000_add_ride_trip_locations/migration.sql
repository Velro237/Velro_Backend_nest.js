-- Add JSON location columns to RideTrip and RideTripStop to store rich location objects
-- similar to the existing Trip model (pickup/destination/departure as Json).

-- RideTrip: departure_location and arrival_location
ALTER TABLE "public"."RideTrip"
ADD COLUMN "departure_location" JSONB,
ADD COLUMN "arrival_location" JSONB;

-- RideTripStop: stop_location
ALTER TABLE "public"."RideTripStop"
ADD COLUMN "stop_location" JSONB;


