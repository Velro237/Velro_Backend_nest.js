-- Add SHIPPING to ChatType for shipping chats
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'ChatType' AND e.enumlabel = 'SHIPPING'
  ) THEN
    ALTER TYPE "ChatType" ADD VALUE 'SHIPPING';
  END IF;
END$$;
