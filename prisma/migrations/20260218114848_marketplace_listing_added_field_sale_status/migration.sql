-- CreateEnum
CREATE TYPE "MarketplaceListingItemSaleStatus" AS ENUM ('PENDING', 'IN_ESCROW', 'SOLD');

-- AlterTable
ALTER TABLE "MarketplaceListing" ADD COLUMN     "saleStatus" "MarketplaceListingItemSaleStatus" NOT NULL DEFAULT 'PENDING';
