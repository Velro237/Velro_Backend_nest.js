/*
  Warnings:

  - You are about to drop the column `request_id` on the `Chat` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[trip_id]` on the table `Chat` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "public"."Chat" DROP CONSTRAINT "Chat_request_id_fkey";

-- DropIndex
DROP INDEX "public"."Chat_request_id_key";

-- AlterTable
ALTER TABLE "public"."Chat" DROP COLUMN "request_id",
ADD COLUMN     "trip_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Chat_trip_id_key" ON "public"."Chat"("trip_id");

-- AddForeignKey
ALTER TABLE "public"."Chat" ADD CONSTRAINT "Chat_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
