-- CreateEnum
CREATE TYPE "public"."ChatType" AS ENUM ('TRIP', 'SUPPORT');

-- AlterTable
ALTER TABLE "public"."Chat" ADD COLUMN     "type" "public"."ChatType" NOT NULL DEFAULT 'TRIP';
