-- Migration: add_offer_status_values
-- Timestamp: 1771160193397

-- Ensure the enum type `OfferStatus` exists with the required values.
DO $$
BEGIN
  -- If the enum type does not exist, create it with the full set of values
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OfferStatus') THEN
    CREATE TYPE "OfferStatus" AS ENUM ('PENDING','ACCEPTED','REJECTED','DELIVERED','COMPLETED','CANCELLED');
  ELSE
    -- If the type exists, add missing labels safely
    IF NOT EXISTS (
      SELECT 1 FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      WHERE t.typname = 'OfferStatus' AND e.enumlabel = 'DELIVERED'
    ) THEN
      ALTER TYPE "OfferStatus" ADD VALUE 'DELIVERED';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      WHERE t.typname = 'OfferStatus' AND e.enumlabel = 'COMPLETED'
    ) THEN
      ALTER TYPE "OfferStatus" ADD VALUE 'COMPLETED';
    END IF;
  END IF;
END$$;
