/*
  Warnings:

  - You are about to drop the `TripPrice` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."TripPrice" DROP CONSTRAINT "TripPrice_trip_id_fkey";

-- DropTable
DROP TABLE "public"."TripPrice";

-- CreateTable
CREATE TABLE "public"."TripItemsListPrice" (
    "trip_id" TEXT NOT NULL,
    "trip_item_id" TEXT NOT NULL,
    "currency" "public"."Currency" NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TripItemsListPrice_pkey" PRIMARY KEY ("trip_id","trip_item_id","currency")
);

-- AddForeignKey
ALTER TABLE "public"."TripItemsListPrice" ADD CONSTRAINT "TripItemsListPrice_trip_id_trip_item_id_fkey" FOREIGN KEY ("trip_id", "trip_item_id") REFERENCES "public"."TripItemsList"("trip_id", "trip_item_id") ON DELETE CASCADE ON UPDATE CASCADE;
