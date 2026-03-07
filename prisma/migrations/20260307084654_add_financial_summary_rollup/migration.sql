-- CreateTable
CREATE TABLE "public"."FinancialSummaryRollup" (
    "id" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "totalVolume_eur" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalVolume_usd" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalVolume_xaf" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalVolume_cad" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "escrowHeld_eur" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "escrowHeld_usd" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "escrowHeld_xaf" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "escrowHeld_cad" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "availableToWithdraw_eur" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "availableToWithdraw_usd" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "availableToWithdraw_xaf" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "availableToWithdraw_cad" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "pendingWithdrawals_eur" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "pendingWithdrawals_usd" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "pendingWithdrawals_xaf" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "pendingWithdrawals_cad" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "commissionEarned_eur" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "commissionEarned_usd" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "commissionEarned_xaf" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "commissionEarned_cad" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialSummaryRollup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FinancialSummaryRollup_periodKey_key" ON "public"."FinancialSummaryRollup"("periodKey");

-- CreateIndex
CREATE INDEX "FinancialSummaryRollup_periodKey_idx" ON "public"."FinancialSummaryRollup"("periodKey");
