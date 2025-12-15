-- DropIndex
DROP INDEX "public"."User_email_key";

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "is_deleted" BOOLEAN NOT NULL DEFAULT false;
