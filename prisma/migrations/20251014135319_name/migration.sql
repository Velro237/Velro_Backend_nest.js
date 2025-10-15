-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "emailVerify" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "otpCode" TEXT;
