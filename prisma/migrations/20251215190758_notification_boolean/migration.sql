-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "email_notification" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "push_notification" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sms_notification" BOOLEAN NOT NULL DEFAULT true;
