/*
  Warnings:

  - Added the required column `airline_id` to the `Trip` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Trip" ADD COLUMN     "airline_id" TEXT NOT NULL,
ALTER COLUMN "mode_of_transport_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "public"."Airline" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Airline_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Airline_name_key" ON "public"."Airline"("name");

-- AddForeignKey
ALTER TABLE "public"."Trip" ADD CONSTRAINT "Trip_airline_id_fkey" FOREIGN KEY ("airline_id") REFERENCES "public"."Airline"("id") ON DELETE SET NULL ON UPDATE CASCADE;
