-- Add request foreign key to Message table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'Message_request_id_fkey' 
    AND table_name = 'Message'
  ) THEN
    ALTER TABLE "Message" 
    ADD CONSTRAINT "Message_request_id_fkey" 
    FOREIGN KEY ("request_id") 
    REFERENCES "TripRequest"("id") 
    ON DELETE CASCADE 
    ON UPDATE CASCADE;
  END IF;
END $$;

-- Drop RideTrip-related foreign keys and columns if they exist
DO $$
BEGIN
  -- Drop foreign key from Chat if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'Chat_ride_trip_id_fkey'
  ) THEN
    ALTER TABLE "Chat" DROP CONSTRAINT "Chat_ride_trip_id_fkey";
  END IF;

  -- Drop foreign key from Message if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'Message_ride_trip_id_fkey'
  ) THEN
    ALTER TABLE "Message" DROP CONSTRAINT "Message_ride_trip_id_fkey";
  END IF;

  -- Drop ride_trip_id column from Chat if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Chat' AND column_name = 'ride_trip_id'
  ) THEN
    ALTER TABLE "Chat" DROP COLUMN "ride_trip_id";
  END IF;

  -- Drop ride_trip_id column from Message if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Message' AND column_name = 'ride_trip_id'
  ) THEN
    ALTER TABLE "Message" DROP COLUMN "ride_trip_id";
  END IF;
END $$;

-- Drop RideTrip-related tables if they exist (in correct order due to foreign keys)
DROP TABLE IF EXISTS "RideTripStop" CASCADE;
DROP TABLE IF EXISTS "RideTripReport" CASCADE;
DROP TABLE IF EXISTS "RideTrip" CASCADE;

-- Drop enums if they exist and are not used elsewhere
DO $$
BEGIN
  -- Only drop if no other tables use these enums
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE udt_name = 'RideTripStatus'
  ) THEN
    DROP TYPE IF EXISTS "RideTripStatus";
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE udt_name = 'TransportMode'
  ) THEN
    DROP TYPE IF EXISTS "TransportMode";
  END IF;
END $$;
