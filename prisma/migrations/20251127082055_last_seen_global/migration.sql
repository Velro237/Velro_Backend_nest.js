/*
  Warnings:

  - You are about to drop the column `last_seen` on the `ChatMember` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."ChatMember" DROP COLUMN "last_seen";

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "last_seen" TIMESTAMP(3);
