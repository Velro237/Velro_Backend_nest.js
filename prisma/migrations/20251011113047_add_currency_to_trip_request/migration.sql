-- AlterTable
ALTER TABLE "TripRequest" ADD COLUMN IF NOT EXISTS "currency" TEXT DEFAULT 'EUR';

