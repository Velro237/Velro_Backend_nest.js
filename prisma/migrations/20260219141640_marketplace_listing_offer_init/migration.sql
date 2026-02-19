-- CreateTable
CREATE TABLE "ListingOffer" (
    "id" UUID NOT NULL,
    "listingId" UUID NOT NULL,
    "buyerId" TEXT NOT NULL,
    "offerAmount" DECIMAL(65,30) NOT NULL,
    "deliveryOption" "MarketplaceListingDeliveryOption" NOT NULL,
    "message" TEXT,
    "chatId" TEXT,
    "status" "OfferStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "ListingOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ListingOffer_chatId_key" ON "ListingOffer"("chatId");

-- CreateIndex
CREATE INDEX "ListingOffer_listingId_idx" ON "ListingOffer"("listingId");

-- CreateIndex
CREATE INDEX "ListingOffer_buyerId_idx" ON "ListingOffer"("buyerId");

-- CreateIndex
CREATE INDEX "ListingOffer_status_idx" ON "ListingOffer"("status");

-- CreateIndex
CREATE INDEX "ListingOffer_chatId_idx" ON "ListingOffer"("chatId");

-- AddForeignKey
ALTER TABLE "ListingOffer" ADD CONSTRAINT "ListingOffer_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "MarketplaceListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingOffer" ADD CONSTRAINT "ListingOffer_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingOffer" ADD CONSTRAINT "ListingOffer_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE SET NULL ON UPDATE CASCADE;
