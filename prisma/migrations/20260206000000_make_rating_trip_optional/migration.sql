-- Migration: make rating.trip_id nullable to allow ratings not tied to a Trip
-- Timestamp: 1771225429855

BEGIN;

ALTER TABLE "Rating" ALTER COLUMN "trip_id" DROP NOT NULL;

COMMIT;
