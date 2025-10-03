-- CreateTable
CREATE TABLE "public"."Rating" (
    "id" TEXT NOT NULL,
    "giver_id" TEXT NOT NULL,
    "receiver_id" TEXT NOT NULL,
    "trip_id" TEXT NOT NULL,
    "request_id" TEXT,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Rating_giver_id_receiver_id_trip_id_key" ON "public"."Rating"("giver_id", "receiver_id", "trip_id");

-- AddForeignKey
ALTER TABLE "public"."Rating" ADD CONSTRAINT "Rating_giver_id_fkey" FOREIGN KEY ("giver_id") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Rating" ADD CONSTRAINT "Rating_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Rating" ADD CONSTRAINT "Rating_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Rating" ADD CONSTRAINT "Rating_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."TripRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
