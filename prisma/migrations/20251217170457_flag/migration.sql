-- AlterTable
ALTER TABLE "public"."Chat" ADD COLUMN     "is_flagged" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."Message" ADD COLUMN     "is_flagged" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "flag_count" INTEGER NOT NULL DEFAULT 0;
