/*
  Warnings:

  - You are about to drop the column `image_url` on the `TripItem` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "public"."Trip" ADD COLUMN     "delivery" JSONB;

-- AlterTable
ALTER TABLE "public"."TripItem" DROP COLUMN "image_url",
ADD COLUMN     "image_id" TEXT;

-- CreateTable
CREATE TABLE "public"."Image" (
    "id" TEXT NOT NULL,
    "object_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "alt_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TripRequest" (
    "id" TEXT NOT NULL,
    "trip_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "public"."RequestStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TripRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TripRequestItem" (
    "request_id" TEXT NOT NULL,
    "trip_item_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "special_notes" TEXT,

    CONSTRAINT "TripRequestItem_pkey" PRIMARY KEY ("request_id","trip_item_id")
);

-- CreateTable
CREATE TABLE "public"."_ImageToTripRequest" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ImageToTripRequest_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Image_object_id_key" ON "public"."Image"("object_id");

-- CreateIndex
CREATE INDEX "_ImageToTripRequest_B_index" ON "public"."_ImageToTripRequest"("B");

-- AddForeignKey
ALTER TABLE "public"."TripItem" ADD CONSTRAINT "TripItem_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "public"."Image"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TripRequest" ADD CONSTRAINT "TripRequest_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TripRequest" ADD CONSTRAINT "TripRequest_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TripRequestItem" ADD CONSTRAINT "TripRequestItem_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."TripRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TripRequestItem" ADD CONSTRAINT "TripRequestItem_trip_item_id_fkey" FOREIGN KEY ("trip_item_id") REFERENCES "public"."TripItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_ImageToTripRequest" ADD CONSTRAINT "_ImageToTripRequest_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Image"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_ImageToTripRequest" ADD CONSTRAINT "_ImageToTripRequest_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."TripRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
