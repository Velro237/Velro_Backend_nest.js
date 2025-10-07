/*
  Warnings:

  - You are about to drop the column `travel_date` on the `Trip` table. All the data in the column will be lost.
  - You are about to drop the column `travel_time` on the `Trip` table. All the data in the column will be lost.
  - Added the required column `departure_date` to the `Trip` table without a default value. This is not possible if the table is not empty.
  - Added the required column `departure_time` to the `Trip` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Trip" DROP COLUMN "travel_date",
DROP COLUMN "travel_time",
ADD COLUMN     "arrival_date" TIMESTAMP(3),
ADD COLUMN     "arrival_time" TEXT,
ADD COLUMN     "departure" JSONB,
ADD COLUMN     "departure_date" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "departure_time" TEXT NOT NULL,
ADD COLUMN     "meetup_flexible" BOOLEAN NOT NULL DEFAULT false;
