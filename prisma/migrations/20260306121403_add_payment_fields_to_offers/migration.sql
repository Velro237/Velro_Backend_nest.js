/*
  Warnings:

  - A unique constraint covering the columns `[payment_intent_id]` on the table `Offer` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[payment_intent_id]` on the table `ShippingOffer` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."TransactionSource" ADD VALUE 'SHOPPING_EARNING';
ALTER TYPE "public"."TransactionSource" ADD VALUE 'SHIPPING_EARNING';

-- AlterTable
ALTER TABLE "public"."Offer" ADD COLUMN     "paid_at" TIMESTAMP(3),
ADD COLUMN     "payment_intent_id" TEXT,
ADD COLUMN     "payment_status" "public"."PaymentStatus";

-- AlterTable
ALTER TABLE "public"."ShippingOffer" ADD COLUMN     "paid_at" TIMESTAMP(3),
ADD COLUMN     "payment_intent_id" TEXT,
ADD COLUMN     "payment_status" "public"."PaymentStatus";

-- AlterTable
ALTER TABLE "public"."Transaction" ADD COLUMN     "offer_id" TEXT,
ADD COLUMN     "shipping_offer_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Offer_payment_intent_id_key" ON "public"."Offer"("payment_intent_id");

-- CreateIndex
CREATE INDEX "Offer_payment_intent_id_idx" ON "public"."Offer"("payment_intent_id");

-- CreateIndex
CREATE UNIQUE INDEX "ShippingOffer_payment_intent_id_key" ON "public"."ShippingOffer"("payment_intent_id");

-- CreateIndex
CREATE INDEX "ShippingOffer_payment_intent_id_idx" ON "public"."ShippingOffer"("payment_intent_id");

-- CreateIndex
CREATE INDEX "Transaction_offer_id_idx" ON "public"."Transaction"("offer_id");

-- CreateIndex
CREATE INDEX "Transaction_shipping_offer_id_idx" ON "public"."Transaction"("shipping_offer_id");

-- AddForeignKey
ALTER TABLE "public"."Transaction" ADD CONSTRAINT "Transaction_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "public"."Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Transaction" ADD CONSTRAINT "Transaction_shipping_offer_id_fkey" FOREIGN KEY ("shipping_offer_id") REFERENCES "public"."ShippingOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
