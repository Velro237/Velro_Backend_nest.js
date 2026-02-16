-- Migration: 1771167792201_add_message_and_offer_status
-- Purpose: Ensure Postgres enums contain the new labels used by the codebase
-- This migration is idempotent: safe to run multiple times and on databases
-- which may already contain some or all of the enum labels.

-- 1) Add MessageType label 'DELIVERY' if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'MessageType' AND e.enumlabel = 'DELIVERY'
  ) THEN
    ALTER TYPE "MessageType" ADD VALUE 'DELIVERY';
  END IF;
END$$;

-- 2) Ensure OfferStatus enum contains DELIVERED and COMPLETED
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OfferStatus') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'OfferStatus' AND e.enumlabel = 'DELIVERED'
    ) THEN
      ALTER TYPE "OfferStatus" ADD VALUE 'DELIVERED';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'OfferStatus' AND e.enumlabel = 'COMPLETED'
    ) THEN
      ALTER TYPE "OfferStatus" ADD VALUE 'COMPLETED';
    END IF;
  ELSE
    -- If the enum doesn't exist for some reason, create it with a safe superset
    CREATE TYPE "OfferStatus" AS ENUM ('PENDING','ACCEPTED','REJECTED','CANCELLED','WITHDRAWN','DELIVERED','COMPLETED');
  END IF;
END$$;

-- End of migration
