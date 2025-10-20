/*
  Warnings:

  - Added the required column `otp_id` to the `PendingUser` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."PendingUser" ADD COLUMN     "otp_id" TEXT NOT NULL;
