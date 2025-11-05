/*
  Warnings:

  - The `currency` column on the `Trip` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `currency` column on the `TripRequest` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "public"."Trip" DROP COLUMN "currency",
ADD COLUMN     "currency" "public"."Currency" NOT NULL DEFAULT 'USD';

-- AlterTable
ALTER TABLE "public"."TripRequest" DROP COLUMN "currency",
ADD COLUMN     "currency" "public"."Currency";
