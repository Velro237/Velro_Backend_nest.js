/*
  Warnings:

  - A unique constraint covering the columns `[username]` on the table `PendingUser` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[username]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."PendingUser" ADD COLUMN     "username" TEXT;

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "username" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "PendingUser_username_key" ON "public"."PendingUser"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "public"."User"("username");
