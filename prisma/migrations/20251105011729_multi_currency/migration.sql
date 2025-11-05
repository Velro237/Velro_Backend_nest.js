-- CreateTable
CREATE TABLE "public"."TripPrice" (
    "id" TEXT NOT NULL,
    "trip_id" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XAF',
    "price" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TripPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TripPrice_trip_id_price_currency_key" ON "public"."TripPrice"("trip_id", "price", "currency");

-- AddForeignKey
ALTER TABLE "public"."TripPrice" ADD CONSTRAINT "TripPrice_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
