-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "is_suspended" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "suspension_reason_en" TEXT,
ADD COLUMN     "suspension_reason_fr" TEXT;
