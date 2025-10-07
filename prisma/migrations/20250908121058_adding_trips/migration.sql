/*
  Warnings:

  - You are about to drop the column `destination_country` on the `Trip` table. All the data in the column will be lost.
  - You are about to drop the column `pickup_country` on the `Trip` table. All the data in the column will be lost.
  - You are about to drop the column `password` on the `User` table. All the data in the column will be lost.
  - Added the required column `mode_of_transport_id` to the `Trip` table without a default value. This is not possible if the table is not empty.
  - Added the required column `price_per_kg` to the `Trip` table without a default value. This is not possible if the table is not empty.
  - Added the required column `travel_date` to the `Trip` table without a default value. This is not possible if the table is not empty.
  - Added the required column `travel_time` to the `Trip` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `Trip` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "public"."userStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "public"."TripStatus" AS ENUM ('PUBLISHED', 'CANCELLED', 'COMPLETED', 'FULLY_BOOKED');

-- AlterTable
ALTER TABLE "public"."Trip" DROP COLUMN "destination_country",
DROP COLUMN "pickup_country",
ADD COLUMN     "destination" JSONB,
ADD COLUMN     "fullSuitcaseOnly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maximum_weight_in_kg" DECIMAL(5,2),
ADD COLUMN     "mode_of_transport_id" TEXT NOT NULL,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "pickup" JSONB,
ADD COLUMN     "price_per_kg" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "status" "public"."TripStatus" NOT NULL DEFAULT 'PUBLISHED',
ADD COLUMN     "travel_date" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "travel_time" TEXT NOT NULL,
ADD COLUMN     "user_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "password",
ADD COLUMN     "role" "public"."UserRole" NOT NULL DEFAULT 'USER';

-- CreateTable
CREATE TABLE "public"."listings_tripitem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "image_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listings_tripitem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."listings_travellisting_trip_items" (
    "trip_id" TEXT NOT NULL,
    "trip_item_id" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listings_travellisting_trip_items_pkey" PRIMARY KEY ("trip_id","trip_item_id")
);

-- CreateTable
CREATE TABLE "public"."TransportType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransportType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "listings_tripitem_name_key" ON "public"."listings_tripitem"("name");

-- CreateIndex
CREATE UNIQUE INDEX "TransportType_name_key" ON "public"."TransportType"("name");

-- AddForeignKey
ALTER TABLE "public"."Trip" ADD CONSTRAINT "Trip_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Trip" ADD CONSTRAINT "Trip_mode_of_transport_id_fkey" FOREIGN KEY ("mode_of_transport_id") REFERENCES "public"."TransportType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."listings_travellisting_trip_items" ADD CONSTRAINT "listings_travellisting_trip_items_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."listings_travellisting_trip_items" ADD CONSTRAINT "listings_travellisting_trip_items_trip_item_id_fkey" FOREIGN KEY ("trip_item_id") REFERENCES "public"."listings_tripitem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
