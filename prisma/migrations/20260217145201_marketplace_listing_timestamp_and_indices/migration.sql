/*
  Warnings:

  - Added the required column `updatedAt` to the `MarketplaceListing` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "MarketplaceListing" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "MarketplaceListing_productName_idx" ON "MarketplaceListing"("productName");

-- CreateIndex
CREATE INDEX "MarketplaceListing_category_idx" ON "MarketplaceListing"("category");

-- CreateIndex
CREATE INDEX "MarketplaceListing_condition_idx" ON "MarketplaceListing"("condition");
