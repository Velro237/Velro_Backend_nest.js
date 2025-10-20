/*
  Warnings:

  - You are about to drop the column `emailVerify` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "emailVerify";

-- CreateTable
CREATE TABLE "public"."PendingUser" (
    "id" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "city" TEXT,
    "companyName" TEXT,
    "companyAddress" TEXT,
    "additionalInfo" TEXT NOT NULL,
    "isFreightForwarder" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendingUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CompanyCity" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "userId" TEXT,

    CONSTRAINT "CompanyCity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CompanyService" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."_PendingUserCities" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_PendingUserCities_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "public"."_UserCities" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_UserCities_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "public"."_UserServices" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_UserServices_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "public"."_PendingUserServices" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_PendingUserServices_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "PendingUser_email_key" ON "public"."PendingUser"("email");

-- CreateIndex
CREATE INDEX "_PendingUserCities_B_index" ON "public"."_PendingUserCities"("B");

-- CreateIndex
CREATE INDEX "_UserCities_B_index" ON "public"."_UserCities"("B");

-- CreateIndex
CREATE INDEX "_UserServices_B_index" ON "public"."_UserServices"("B");

-- CreateIndex
CREATE INDEX "_PendingUserServices_B_index" ON "public"."_PendingUserServices"("B");

-- AddForeignKey
ALTER TABLE "public"."_PendingUserCities" ADD CONSTRAINT "_PendingUserCities_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."CompanyCity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_PendingUserCities" ADD CONSTRAINT "_PendingUserCities_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."PendingUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_UserCities" ADD CONSTRAINT "_UserCities_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."CompanyCity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_UserCities" ADD CONSTRAINT "_UserCities_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_UserServices" ADD CONSTRAINT "_UserServices_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."CompanyService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_UserServices" ADD CONSTRAINT "_UserServices_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_PendingUserServices" ADD CONSTRAINT "_PendingUserServices_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."CompanyService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_PendingUserServices" ADD CONSTRAINT "_PendingUserServices_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."PendingUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
