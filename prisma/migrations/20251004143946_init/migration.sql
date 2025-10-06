/*
  Warnings:

  - You are about to drop the `UserKYC` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `password` on table `User` required. This step will fail if there are existing NULL values in that column.
  - Made the column `name` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "public"."UserKYC" DROP CONSTRAINT "UserKYC_userId_fkey";

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "companyAddress" TEXT,
ADD COLUMN     "companyName" TEXT,
ADD COLUMN     "isFreightForwarder" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "password" SET NOT NULL,
ALTER COLUMN "name" SET NOT NULL;

-- DropTable
DROP TABLE "public"."UserKYC";

-- DropEnum
DROP TYPE "public"."KYCProvider";

-- DropEnum
DROP TYPE "public"."KYCStatus";
