/*
  Warnings:

  - You are about to drop the column `suspension_reason_en` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `suspension_reason_fr` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `status_message` on the `Wallet` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "suspension_reason_en",
DROP COLUMN "suspension_reason_fr",
ADD COLUMN     "status_message_en" TEXT,
ADD COLUMN     "status_message_fr" TEXT;

-- AlterTable
ALTER TABLE "public"."Wallet" DROP COLUMN "status_message",
ADD COLUMN     "status_message_en" TEXT,
ADD COLUMN     "status_message_fr" TEXT;
