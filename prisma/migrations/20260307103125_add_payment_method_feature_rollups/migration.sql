-- AlterEnum
ALTER TYPE "public"."TransactionProvider" ADD VALUE 'PAYPAL';

-- CreateTable
CREATE TABLE "public"."PaymentMethodRollup" (
    "id" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "stripe_eur" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "stripe_xaf" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "stripe_usd" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "stripe_cad" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "stripe_count" INTEGER NOT NULL DEFAULT 0,
    "mtn_eur" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "mtn_xaf" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "mtn_usd" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "mtn_cad" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "mtn_count" INTEGER NOT NULL DEFAULT 0,
    "orange_eur" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "orange_xaf" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "orange_usd" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "orange_cad" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "orange_count" INTEGER NOT NULL DEFAULT 0,
    "paypal_eur" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "paypal_xaf" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "paypal_usd" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "paypal_cad" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "paypal_count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentMethodRollup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FeatureSummaryRollup" (
    "id" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "sales_total_eur" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "sales_total_xaf" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "sales_total_usd" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "sales_total_cad" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "sales_commission_eur" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "sales_commission_xaf" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "sales_commission_usd" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "sales_commission_cad" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "sales_count" INTEGER NOT NULL DEFAULT 0,
    "shopping_total_eur" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "shopping_total_xaf" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "shopping_total_usd" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "shopping_total_cad" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "shopping_commission_eur" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "shopping_commission_xaf" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "shopping_commission_usd" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "shopping_commission_cad" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "shopping_count" INTEGER NOT NULL DEFAULT 0,
    "shipping_total_eur" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "shipping_total_xaf" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "shipping_total_usd" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "shipping_total_cad" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "shipping_commission_eur" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "shipping_commission_xaf" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "shipping_commission_usd" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "shipping_commission_cad" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "shipping_count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureSummaryRollup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethodRollup_periodKey_key" ON "public"."PaymentMethodRollup"("periodKey");

-- CreateIndex
CREATE INDEX "PaymentMethodRollup_periodKey_idx" ON "public"."PaymentMethodRollup"("periodKey");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureSummaryRollup_periodKey_key" ON "public"."FeatureSummaryRollup"("periodKey");

-- CreateIndex
CREATE INDEX "FeatureSummaryRollup_periodKey_idx" ON "public"."FeatureSummaryRollup"("periodKey");
