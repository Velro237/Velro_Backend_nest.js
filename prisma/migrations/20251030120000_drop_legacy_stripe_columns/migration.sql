-- Drop legacy stripe balance columns from Wallet
ALTER TABLE "public"."Wallet"
  DROP COLUMN IF EXISTS "available_balance_stripe",
  DROP COLUMN IF EXISTS "pending_balance_stripe",
  DROP COLUMN IF EXISTS "withdrawn_total_stripe";


