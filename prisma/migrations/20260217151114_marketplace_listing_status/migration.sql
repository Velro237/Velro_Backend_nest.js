-- CreateEnum
CREATE TYPE "MarketplaceListingItemStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "MarketplaceListing" ADD COLUMN     "status" "MarketplaceListingItemStatus" NOT NULL DEFAULT 'DRAFT';

-- CreateIndex
CREATE INDEX "MarketplaceListing_status_idx" ON "MarketplaceListing"("status");
