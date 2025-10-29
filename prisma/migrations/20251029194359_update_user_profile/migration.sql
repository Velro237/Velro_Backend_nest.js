/*
  Warnings:

  - You are about to drop the column `otpCode` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."PendingUser" ADD COLUMN     "lang" TEXT DEFAULT 'en';

-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "otpCode",
ADD COLUMN     "date_of_birth" TIMESTAMP(3),
ADD COLUMN     "lang" TEXT DEFAULT 'en';
