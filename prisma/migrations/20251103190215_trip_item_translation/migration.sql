-- CreateEnum
CREATE TYPE "public"."Language" AS ENUM ('EN', 'FR', 'ES', 'DE', 'PT', 'AR');

-- CreateTable
CREATE TABLE "public"."Translation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "language" "public"."Language" NOT NULL DEFAULT 'EN',
    "trip_item_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Translation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Translation_trip_item_id_language_key" ON "public"."Translation"("trip_item_id", "language");

-- AddForeignKey
ALTER TABLE "public"."Translation" ADD CONSTRAINT "Translation_trip_item_id_fkey" FOREIGN KEY ("trip_item_id") REFERENCES "public"."TripItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
