/*
  Warnings:

  - Added the required column `deliveryOption` to the `MarketplaceListing` table without a default value. This is not possible if the table is not empty.
  - Added the required column `quantity` to the `MarketplaceListing` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "MarketplaceListingDeliveryOption" AS ENUM ('SELF_SHIP', 'TRAVELER_DELIVERY', 'LOCAL_MEETUP');

-- AlterTable
ALTER TABLE "MarketplaceListing" ADD COLUMN     "deliveryOption" "MarketplaceListingDeliveryOption" NOT NULL,
ADD COLUMN     "isNegotiable" BOOLEAN DEFAULT false,
ADD COLUMN     "quantity" INTEGER NOT NULL;
