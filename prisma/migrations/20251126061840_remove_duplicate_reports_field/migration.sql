-- CreateEnum
CREATE TYPE "public"."TransportMode" AS ENUM ('CAR', 'AIRPLANE');

-- CreateEnum
CREATE TYPE "public"."RideTripStatus" AS ENUM ('PUBLISHED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."ReportType" ADD VALUE 'INAPPROPRIATE_CONTENT';
ALTER TYPE "public"."ReportType" ADD VALUE 'FAKE_TRIP';
ALTER TYPE "public"."ReportType" ADD VALUE 'SCAM_OR_FRAUD_ATTEMPT';

-- AlterTable
ALTER TABLE "public"."Chat" ADD COLUMN     "ride_trip_id" TEXT;

-- AlterTable
ALTER TABLE "public"."Message" ADD COLUMN     "ride_trip_id" TEXT;

-- CreateTable
CREATE TABLE "public"."RideTripReport" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "reported_id" TEXT NOT NULL,
    "reply_to_id" TEXT,
    "ride_trip_id" TEXT NOT NULL,
    "type" "public"."ReportType" NOT NULL,
    "text" TEXT,
    "priority" "public"."ReportPriority" NOT NULL,
    "status" "public"."ReportStatus" NOT NULL DEFAULT 'PENDING',
    "data" JSONB,
    "replied_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "images" JSONB,

    CONSTRAINT "RideTripReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."City" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RideTrip" (
    "id" TEXT NOT NULL,
    "driver_id" TEXT NOT NULL,
    "transport_mode" "public"."TransportMode" NOT NULL,
    "departure_city_id" TEXT NOT NULL,
    "departure_area_text" TEXT,
    "arrival_city_id" TEXT NOT NULL,
    "arrival_area_text" TEXT,
    "departure_datetime" TIMESTAMP(3) NOT NULL,
    "seats_available" INTEGER NOT NULL,
    "base_price_per_seat" DECIMAL(10,2) NOT NULL,
    "status" "public"."RideTripStatus" NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RideTrip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RideTripStop" (
    "id" TEXT NOT NULL,
    "ride_trip_id" TEXT NOT NULL,
    "stop_order" INTEGER NOT NULL,
    "stop_city_id" TEXT NOT NULL,
    "price_per_seat_to_stop" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RideTripStop_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RideTripReport_ride_trip_id_idx" ON "public"."RideTripReport"("ride_trip_id");

-- CreateIndex
CREATE UNIQUE INDEX "City_name_key" ON "public"."City"("name");

-- CreateIndex
CREATE INDEX "RideTrip_driver_id_idx" ON "public"."RideTrip"("driver_id");

-- CreateIndex
CREATE INDEX "RideTrip_departure_city_id_idx" ON "public"."RideTrip"("departure_city_id");

-- CreateIndex
CREATE INDEX "RideTrip_arrival_city_id_idx" ON "public"."RideTrip"("arrival_city_id");

-- CreateIndex
CREATE INDEX "RideTrip_status_idx" ON "public"."RideTrip"("status");

-- CreateIndex
CREATE INDEX "RideTrip_departure_datetime_idx" ON "public"."RideTrip"("departure_datetime");

-- CreateIndex
CREATE INDEX "RideTripStop_ride_trip_id_idx" ON "public"."RideTripStop"("ride_trip_id");

-- CreateIndex
CREATE INDEX "RideTripStop_stop_city_id_idx" ON "public"."RideTripStop"("stop_city_id");

-- CreateIndex
CREATE UNIQUE INDEX "RideTripStop_ride_trip_id_stop_order_key" ON "public"."RideTripStop"("ride_trip_id", "stop_order");

-- CreateIndex
CREATE INDEX "Report_trip_id_idx" ON "public"."Report"("trip_id");

-- AddForeignKey
ALTER TABLE "public"."Chat" ADD CONSTRAINT "Chat_ride_trip_id_fkey" FOREIGN KEY ("ride_trip_id") REFERENCES "public"."RideTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_ride_trip_id_fkey" FOREIGN KEY ("ride_trip_id") REFERENCES "public"."RideTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RideTripReport" ADD CONSTRAINT "RideTripReport_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RideTripReport" ADD CONSTRAINT "RideTripReport_reported_id_fkey" FOREIGN KEY ("reported_id") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RideTripReport" ADD CONSTRAINT "RideTripReport_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "public"."RideTripReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RideTripReport" ADD CONSTRAINT "RideTripReport_ride_trip_id_fkey" FOREIGN KEY ("ride_trip_id") REFERENCES "public"."RideTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RideTripReport" ADD CONSTRAINT "RideTripReport_replied_by_fkey" FOREIGN KEY ("replied_by") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RideTrip" ADD CONSTRAINT "RideTrip_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RideTrip" ADD CONSTRAINT "RideTrip_departure_city_id_fkey" FOREIGN KEY ("departure_city_id") REFERENCES "public"."City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RideTrip" ADD CONSTRAINT "RideTrip_arrival_city_id_fkey" FOREIGN KEY ("arrival_city_id") REFERENCES "public"."City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RideTripStop" ADD CONSTRAINT "RideTripStop_ride_trip_id_fkey" FOREIGN KEY ("ride_trip_id") REFERENCES "public"."RideTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RideTripStop" ADD CONSTRAINT "RideTripStop_stop_city_id_fkey" FOREIGN KEY ("stop_city_id") REFERENCES "public"."City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
