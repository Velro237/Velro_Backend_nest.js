-- CreateEnum
CREATE TYPE "ShippingDeliveryTimeframe" AS ENUM ('WITHIN_3_DAYS', 'WITHIN_1_WEEK', 'WITHIN_2_WEEKS', 'FLEXIBLE');

-- CreateEnum
CREATE TYPE "ShippingWeight" AS ENUM ('UNDER_1KG', 'KG_1_TO_3', 'KG_3_TO_5', 'KG_5_TO_10', 'ABOVE_10_KG');

-- CreateEnum
CREATE TYPE "ShippingCategory" AS ENUM ('LAPTOP', 'PHONE', 'DOCUMENTS', 'FULL SUITCASE', 'ELECTRONICS', 'CUSTOM WEIGHT');

-- CreateEnum
CREATE TYPE "ShippingRequestStatus" AS ENUM ('PUBLISHED', 'BOOKED', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ShoppingRequestStatus" AS ENUM ('PUBLISHED', 'OFFER_ACCEPTED', 'PAID', 'BOUGHT', 'PENDING_DELIVERY', 'DELIVERED', 'COMPLETED', 'DISPUTED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DeliveryTimeframe" AS ENUM ('ONE_WEEK', 'TWO_WEEKS', 'ONE_MONTH', 'FLEXIBLE');

-- CreateEnum
CREATE TYPE "RequestSource" AS ENUM ('WEBVIEW', 'URL', 'MANUAL');

-- CreateEnum
CREATE TYPE "ProductSource" AS ENUM ('AMAZON', 'SHEIN', 'HM', 'NIKE', 'ZARA', 'APPLE', 'EBAY', 'OTHER');

-- CreateTable
CREATE TABLE "ShippingRequest" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "category" "ShippingCategory" NOT NULL,
    "package_photo_urls" TEXT[],
    "package_description" TEXT NOT NULL,
    "details_description" TEXT,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "delivery_timeframe" "ShippingDeliveryTimeframe" NOT NULL,
    "weight" "ShippingWeight" NOT NULL,
    "packaging" BOOLEAN NOT NULL DEFAULT false,
    "traveler_reward" DECIMAL(65,30) NOT NULL,
    "status" "ShippingRequestStatus" NOT NULL DEFAULT 'PUBLISHED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShippingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "shopping_request_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "source" "ProductSource" NOT NULL,
    "url" TEXT,
    "image_urls" TEXT[],
    "price" DECIMAL(65,30) NOT NULL,
    "price_currency" "Currency" NOT NULL,
    "weight" DECIMAL(65,30),
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "variants" JSONB,
    "in_stock" BOOLEAN NOT NULL DEFAULT true,
    "availability_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShoppingRequest" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "current_version" INTEGER NOT NULL DEFAULT 1,
    "last_edited_at" TIMESTAMP(3),
    "source" "RequestSource" NOT NULL,
    "deliver_to" TEXT NOT NULL,
    "delivery_timeframe" "DeliveryTimeframe" NOT NULL,
    "packaging_option" BOOLEAN NOT NULL DEFAULT false,
    "product_price" DECIMAL(65,30) NOT NULL,
    "product_currency" "Currency" NOT NULL,
    "traveler_reward" DECIMAL(65,30) NOT NULL,
    "platform_fee" DECIMAL(65,30) NOT NULL,
    "additional_fees" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total_cost" DECIMAL(65,30) NOT NULL,
    "suggested_reward_percentage" DECIMAL(65,30) NOT NULL DEFAULT 15,
    "reward_currency" "Currency" NOT NULL,
    "status" "ShoppingRequestStatus" NOT NULL DEFAULT 'PUBLISHED',
    "expires_at" TIMESTAMP(3),
    "additional_notes" TEXT,
    "chat_id" TEXT,
    "purchase_proof_url" TEXT,
    "purchase_proof_uploaded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "paid_at" TIMESTAMP(3),
    "bought_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancelled_by_id" TEXT,

    CONSTRAINT "ShoppingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "shopping_request_id" TEXT NOT NULL,
    "traveler_id" TEXT NOT NULL,
    "request_version" INTEGER NOT NULL,
    "reward_amount" DECIMAL(65,30) NOT NULL,
    "reward_currency" "Currency" NOT NULL,
    "additional_fees" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "travel_date" TIMESTAMP(3),
    "message" TEXT,
    "status" "OfferStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryTracking" (
    "id" TEXT NOT NULL,
    "shopping_request_id" TEXT NOT NULL,
    "marked_delivered_at" TIMESTAMP(3),
    "auto_release_at" TIMESTAMP(3),
    "confirmed_at" TIMESTAMP(3),
    "confirmed_by" TEXT,
    "issue_reported" BOOLEAN NOT NULL DEFAULT false,
    "issue_reported_at" TIMESTAMP(3),
    "issue_reported_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryTracking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TravelerStrike" (
    "id" TEXT NOT NULL,
    "traveler_id" TEXT NOT NULL,
    "offer_id" TEXT NOT NULL,
    "shopping_request_id" TEXT NOT NULL,
    "cancelled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_banned" BOOLEAN NOT NULL DEFAULT false,
    "banned_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TravelerStrike_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShoppingRequest_chat_id_key" ON "ShoppingRequest"("chat_id");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryTracking_shopping_request_id_key" ON "DeliveryTracking"("shopping_request_id");

-- CreateIndex
CREATE INDEX "ShippingRequest_user_id_idx" ON "ShippingRequest"("user_id");
CREATE INDEX "ShippingRequest_delivery_timeframe_idx" ON "ShippingRequest"("delivery_timeframe");
CREATE INDEX "ShippingRequest_weight_idx" ON "ShippingRequest"("weight");
CREATE INDEX "ShippingRequest_status_idx" ON "ShippingRequest"("status");
CREATE INDEX "ShippingRequest_category_idx" ON "ShippingRequest"("category");
CREATE INDEX "ShippingRequest_from_idx" ON "ShippingRequest"("from");
CREATE INDEX "ShippingRequest_to_idx" ON "ShippingRequest"("to");
CREATE INDEX "ShippingRequest_created_at_idx" ON "ShippingRequest"("created_at");
CREATE INDEX "ShippingRequest_traveler_reward_idx" ON "ShippingRequest"("traveler_reward");

CREATE INDEX "Product_shopping_request_id_idx" ON "Product"("shopping_request_id");

CREATE INDEX "ShoppingRequest_user_id_idx" ON "ShoppingRequest"("user_id");
CREATE INDEX "ShoppingRequest_status_idx" ON "ShoppingRequest"("status");
CREATE INDEX "ShoppingRequest_expires_at_idx" ON "ShoppingRequest"("expires_at");
CREATE INDEX "ShoppingRequest_created_at_idx" ON "ShoppingRequest"("created_at");

CREATE INDEX "Offer_shopping_request_id_idx" ON "Offer"("shopping_request_id");
CREATE INDEX "Offer_traveler_id_idx" ON "Offer"("traveler_id");
CREATE INDEX "Offer_status_idx" ON "Offer"("status");
CREATE INDEX "Offer_request_version_idx" ON "Offer"("request_version");

CREATE INDEX "DeliveryTracking_auto_release_at_idx" ON "DeliveryTracking"("auto_release_at");
CREATE INDEX "DeliveryTracking_marked_delivered_at_idx" ON "DeliveryTracking"("marked_delivered_at");

CREATE INDEX "TravelerStrike_traveler_id_idx" ON "TravelerStrike"("traveler_id");
CREATE INDEX "TravelerStrike_is_banned_idx" ON "TravelerStrike"("is_banned");

-- AddForeignKey
ALTER TABLE "ShippingRequest" ADD CONSTRAINT "ShippingRequest_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Product" ADD CONSTRAINT "Product_shopping_request_id_fkey" FOREIGN KEY ("shopping_request_id") REFERENCES "ShoppingRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ShoppingRequest" ADD CONSTRAINT "ShoppingRequest_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShoppingRequest" ADD CONSTRAINT "ShoppingRequest_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "Chat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Offer" ADD CONSTRAINT "Offer_shopping_request_id_fkey" FOREIGN KEY ("shopping_request_id") REFERENCES "ShoppingRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_traveler_id_fkey" FOREIGN KEY ("traveler_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DeliveryTracking" ADD CONSTRAINT "DeliveryTracking_shopping_request_id_fkey" FOREIGN KEY ("shopping_request_id") REFERENCES "ShoppingRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TravelerStrike" ADD CONSTRAINT "TravelerStrike_traveler_id_fkey" FOREIGN KEY ("traveler_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
