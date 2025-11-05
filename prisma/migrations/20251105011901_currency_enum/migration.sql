/*
  Warnings:

  - Changed the type of `currency` on the `TripPrice` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "public"."Currency" AS ENUM ('XAF', 'USD', 'EUR', 'CAD');

-- AlterTable
ALTER TABLE "public"."TripPrice" DROP COLUMN "currency",
ADD COLUMN     "currency" "public"."Currency" NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "TripPrice_trip_id_price_currency_key" ON "public"."TripPrice"("trip_id", "price", "currency");
