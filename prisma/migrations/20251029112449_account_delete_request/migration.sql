-- CreateEnum
CREATE TYPE "public"."deleteRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "public"."AccountDeleteRequest" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" "public"."deleteRequestStatus" NOT NULL DEFAULT 'PENDING',
    "user_id" TEXT NOT NULL,

    CONSTRAINT "AccountDeleteRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountDeleteRequest_user_id_idx" ON "public"."AccountDeleteRequest"("user_id");

-- CreateIndex
CREATE INDEX "AccountDeleteRequest_email_idx" ON "public"."AccountDeleteRequest"("email");

-- AddForeignKey
ALTER TABLE "public"."AccountDeleteRequest" ADD CONSTRAINT "AccountDeleteRequest_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
