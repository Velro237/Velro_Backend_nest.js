-- AlterTable
ALTER TABLE "public"."Trip" DROP COLUMN "price_per_kg";

-- AlterTable
ALTER TABLE "public"."Trip" DROP COLUMN "fullSuitcaseOnly";

-- AlterTable
ALTER TABLE "public"."TripItemsList" ADD COLUMN     "avalailble_kg" DECIMAL(10,2);
