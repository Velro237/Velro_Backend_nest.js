/*
  Warnings:

  - You are about to drop the `_ImageToTripRequest` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `password` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."MessageType" AS ENUM ('TEXT', 'IMAGE', 'REQUEST', 'PAYMENT');

-- CreateEnum
CREATE TYPE "public"."UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- DropForeignKey
ALTER TABLE "public"."_ImageToTripRequest" DROP CONSTRAINT "_ImageToTripRequest_A_fkey";

-- DropForeignKey
ALTER TABLE "public"."_ImageToTripRequest" DROP CONSTRAINT "_ImageToTripRequest_B_fkey";

-- DropIndex
DROP INDEX "public"."Image_object_id_key";

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "password" TEXT NOT NULL;

-- DropTable
DROP TABLE "public"."_ImageToTripRequest";

-- DropEnum
DROP TYPE "public"."userStatus";

-- CreateTable
CREATE TABLE "public"."Chat" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ChatMember" (
    "id" TEXT NOT NULL,
    "chat_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Message" (
    "id" TEXT NOT NULL,
    "chat_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "content" TEXT,
    "image_url" TEXT,
    "request_id" TEXT,
    "type" "public"."MessageType" NOT NULL DEFAULT 'TEXT',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reply_to_id" TEXT,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TripRequestImage" (
    "trip_request_id" TEXT NOT NULL,
    "image_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripRequestImage_pkey" PRIMARY KEY ("trip_request_id","image_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChatMember_user_id_chat_id_key" ON "public"."ChatMember"("user_id", "chat_id");

-- AddForeignKey
ALTER TABLE "public"."ChatMember" ADD CONSTRAINT "ChatMember_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "public"."Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChatMember" ADD CONSTRAINT "ChatMember_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "public"."Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "public"."Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."TripRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TripRequestImage" ADD CONSTRAINT "TripRequestImage_trip_request_id_fkey" FOREIGN KEY ("trip_request_id") REFERENCES "public"."TripRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TripRequestImage" ADD CONSTRAINT "TripRequestImage_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "public"."Image"("id") ON DELETE CASCADE ON UPDATE CASCADE;
