-- CreateEnum
CREATE TYPE "public"."DeliveryStatus" AS ENUM ('PENDING', 'ONGOING', 'EXPIRED');

-- CreateTable
CREATE TABLE "public"."Delivery" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "total_cost" DECIMAL(10,2) NOT NULL,
    "description" TEXT,
    "currency" "public"."Currency" NOT NULL,
    "status" "public"."DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "reward" INTEGER NOT NULL DEFAULT 15,
    "expected_date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "data" JSONB,
    "transaction_id" TEXT,

    CONSTRAINT "Delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DeliveryProduct" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "currency" "public"."Currency" NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "weight" DECIMAL(10,2),
    "description" TEXT,
    "quantity" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Delivery_transaction_id_key" ON "public"."Delivery"("transaction_id");

-- CreateIndex
CREATE INDEX "Delivery_userId_idx" ON "public"."Delivery"("userId");

-- CreateIndex
CREATE INDEX "Delivery_transaction_id_idx" ON "public"."Delivery"("transaction_id");

-- AddForeignKey
ALTER TABLE "public"."Delivery" ADD CONSTRAINT "Delivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Delivery" ADD CONSTRAINT "Delivery_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DeliveryProduct" ADD CONSTRAINT "DeliveryProduct_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "public"."Delivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
