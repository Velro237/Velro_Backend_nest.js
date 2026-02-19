/*
  Warnings:

  - A unique constraint covering the columns `[buyerId,listingId]` on the table `ListingOffer` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "ListingOffer_buyerId_listingId_key" ON "ListingOffer"("buyerId", "listingId");
