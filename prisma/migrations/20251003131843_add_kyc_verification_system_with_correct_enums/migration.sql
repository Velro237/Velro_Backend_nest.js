-- CreateEnum
CREATE TYPE "public"."KYCStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'APPROVED', 'DECLINED', 'KYC_EXPIRED', 'IN_REVIEW', 'EXPIRED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "public"."KYCProvider" AS ENUM ('DIDIT', 'OTHER');

-- CreateTable
CREATE TABLE "public"."UserKYC" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "diditSessionId" TEXT,
    "diditWorkflowId" TEXT,
    "sessionUrl" TEXT,
    "callbackUrl" TEXT,
    "status" "public"."KYCStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "provider" "public"."KYCProvider" NOT NULL DEFAULT 'DIDIT',
    "verificationData" JSONB,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "UserKYC_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserKYC_diditSessionId_key" ON "public"."UserKYC"("diditSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "UserKYC_userId_provider_key" ON "public"."UserKYC"("userId", "provider");

-- AddForeignKey
ALTER TABLE "public"."UserKYC" ADD CONSTRAINT "UserKYC_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
