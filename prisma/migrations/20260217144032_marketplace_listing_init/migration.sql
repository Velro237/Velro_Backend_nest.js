-- CreateEnum
CREATE TYPE "ProofImageType" AS ENUM ('RECEIPT', 'PRODUCT_PHOTO');

-- CreateEnum
CREATE TYPE "ProofStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ProofDecision" AS ENUM ('APPROVE', 'REJECT');

-- CreateEnum
CREATE TYPE "MarketplaceCategory" AS ENUM ('ELECTRONICS', 'MEDICATIONS', 'BEAUTY_AND_COSMETICS', 'FASHION_AND_CLOTHING', 'HOME_AND_GARDEN', 'BOOKS_AND_EDUCATION', 'SPORTS_AND_OUTDOORS', 'GAMING_AND_TOYS', 'AUTOMOTIVE', 'FOOD_AND_BEVERAGES', 'JEWELRY_AND_ACCESSORIES', 'MUSIC_AND_INSTRUMENTS', 'OTHER');

-- CreateEnum
CREATE TYPE "MarketplaceListingItemCondition" AS ENUM ('NEW', 'LIKE_NEW', 'VERY_GOOD', 'FAIR');

-- DropIndex
DROP INDEX "Rating_shopping_request_id_idx";

-- AlterTable
ALTER TABLE "ShippingOffer" ADD COLUMN     "delivered_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PurchaseProof" (
    "id" TEXT NOT NULL,
    "offer_id" TEXT,
    "uploader_id" TEXT NOT NULL,
    "status" "ProofStatus" NOT NULL DEFAULT 'PENDING',
    "primary_receipt_image_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseProof_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProofImage" (
    "id" TEXT NOT NULL,
    "proof_id" TEXT NOT NULL,
    "image_id" TEXT NOT NULL,
    "type" "ProofImageType" NOT NULL,
    "ord" INTEGER,

    CONSTRAINT "ProofImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProofVerification" (
    "id" TEXT NOT NULL,
    "proof_id" TEXT NOT NULL,
    "verified_by" TEXT,
    "decision" "ProofDecision" NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProofVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceListing" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "imageUrls" TEXT[],
    "productName" TEXT NOT NULL,
    "category" "MarketplaceCategory" NOT NULL,
    "description" TEXT,
    "condition" "MarketplaceListingItemCondition" NOT NULL,
    "price" DECIMAL(65,30) NOT NULL,
    "currency" "Currency" NOT NULL,
    "location" TEXT NOT NULL,
    "canShipInternationally" BOOLEAN DEFAULT false,

    CONSTRAINT "MarketplaceListing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PurchaseProof_offer_id_idx" ON "PurchaseProof"("offer_id");

-- CreateIndex
CREATE INDEX "PurchaseProof_uploader_id_idx" ON "PurchaseProof"("uploader_id");

-- CreateIndex
CREATE INDEX "ProofImage_proof_id_idx" ON "ProofImage"("proof_id");

-- CreateIndex
CREATE INDEX "ProofImage_image_id_idx" ON "ProofImage"("image_id");

-- CreateIndex
CREATE INDEX "ProofVerification_proof_id_idx" ON "ProofVerification"("proof_id");

-- AddForeignKey
ALTER TABLE "PurchaseProof" ADD CONSTRAINT "PurchaseProof_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseProof" ADD CONSTRAINT "PurchaseProof_uploader_id_fkey" FOREIGN KEY ("uploader_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseProof" ADD CONSTRAINT "PurchaseProof_primary_receipt_image_id_fkey" FOREIGN KEY ("primary_receipt_image_id") REFERENCES "Image"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProofImage" ADD CONSTRAINT "ProofImage_proof_id_fkey" FOREIGN KEY ("proof_id") REFERENCES "PurchaseProof"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProofImage" ADD CONSTRAINT "ProofImage_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "Image"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProofVerification" ADD CONSTRAINT "ProofVerification_proof_id_fkey" FOREIGN KEY ("proof_id") REFERENCES "PurchaseProof"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceListing" ADD CONSTRAINT "MarketplaceListing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
