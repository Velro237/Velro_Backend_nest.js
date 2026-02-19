-- CreateIndex
CREATE INDEX "MarketplaceListing_createdAt_id_idx" ON "MarketplaceListing"("createdAt", "id");

-- CreateIndex
CREATE INDEX "MarketplaceListing_price_id_idx" ON "MarketplaceListing"("price", "id");
