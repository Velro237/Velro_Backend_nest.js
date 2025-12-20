-- AlterTable
ALTER TABLE "public"."Trip" ADD COLUMN     "is_deleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."TripRequest" ADD COLUMN     "is_deleted" BOOLEAN NOT NULL DEFAULT false;
