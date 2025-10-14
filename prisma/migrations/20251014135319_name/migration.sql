/*
  Warnings:

  - Added the required column `otpCode` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "emailVerify" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "otpCode" TEXT NOT NULL;
