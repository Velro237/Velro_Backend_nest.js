/*
  Warnings:

  - You are about to drop the `listings_travellisting_trip_items` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `listings_tripitem` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."listings_travellisting_trip_items" DROP CONSTRAINT "listings_travellisting_trip_items_trip_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."listings_travellisting_trip_items" DROP CONSTRAINT "listings_travellisting_trip_items_trip_item_id_fkey";

-- DropTable
DROP TABLE "public"."listings_travellisting_trip_items";

-- DropTable
DROP TABLE "public"."listings_tripitem";

-- CreateTable
CREATE TABLE "public"."TripItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "image_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TripItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TripItemsList" (
    "trip_id" TEXT NOT NULL,
    "trip_item_id" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TripItemsList_pkey" PRIMARY KEY ("trip_id","trip_item_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TripItem_name_key" ON "public"."TripItem"("name");

-- AddForeignKey
ALTER TABLE "public"."TripItemsList" ADD CONSTRAINT "TripItemsList_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TripItemsList" ADD CONSTRAINT "TripItemsList_trip_item_id_fkey" FOREIGN KEY ("trip_item_id") REFERENCES "public"."TripItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
