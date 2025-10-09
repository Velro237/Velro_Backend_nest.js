-- CreateEnum
CREATE TYPE "public"."TransactionType" AS ENUM ('TRIP_EARNING', 'WITHDRAW', 'REFUND', 'FEE');

-- CreateEnum
CREATE TYPE "public"."TransactionStatus" AS ENUM ('PENDING', 'SUCCESS', 'ONHOLD', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."TransactionProvider" AS ENUM ('MTN', 'ORANGE', 'STRIPE');

-- CreateEnum
CREATE TYPE "public"."WalletState" AS ENUM ('ACTIVE', 'BLOCKED');

-- CreateTable
CREATE TABLE "public"."Wallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "available_balance" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "hold_balance" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "total_balance" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "state" "public"."WalletState" NOT NULL DEFAULT 'BLOCKED',
    "currency" TEXT NOT NULL DEFAULT 'XAF',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Transaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "trip_id" TEXT,
    "request_id" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "type" "public"."TransactionType" NOT NULL,
    "status" "public"."TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "reference" TEXT NOT NULL,
    "provider" "public"."TransactionProvider" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "walletId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_userId_key" ON "public"."Wallet"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_reference_key" ON "public"."Transaction"("reference");

-- AddForeignKey
ALTER TABLE "public"."Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Transaction" ADD CONSTRAINT "Transaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "public"."Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Transaction" ADD CONSTRAINT "Transaction_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Transaction" ADD CONSTRAINT "Transaction_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."TripRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
