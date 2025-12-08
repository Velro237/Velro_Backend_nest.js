-- CreateEnum
CREATE TYPE "public"."loggerType" AS ENUM ('MESSAGE');

-- CreateTable
CREATE TABLE "public"."Logger" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "error_message" TEXT NOT NULL,
    "type" "public"."loggerType" NOT NULL,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Logger_pkey" PRIMARY KEY ("id")
);
