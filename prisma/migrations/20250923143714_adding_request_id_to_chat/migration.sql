/*
  Warnings:

  - A unique constraint covering the columns `[request_id]` on the table `Chat` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."Chat" ADD COLUMN     "request_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Chat_request_id_key" ON "public"."Chat"("request_id");

-- AddForeignKey
ALTER TABLE "public"."Chat" ADD CONSTRAINT "Chat_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."TripRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
