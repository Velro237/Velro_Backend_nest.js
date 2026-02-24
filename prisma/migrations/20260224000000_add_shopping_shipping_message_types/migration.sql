-- Add SHOPPING and SHIPPING to MessageType for module-specific system messages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'MessageType' AND e.enumlabel = 'SHOPPING'
  ) THEN
    ALTER TYPE "MessageType" ADD VALUE 'SHOPPING';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'MessageType' AND e.enumlabel = 'SHIPPING'
  ) THEN
    ALTER TYPE "MessageType" ADD VALUE 'SHIPPING';
  END IF;
END$$;
