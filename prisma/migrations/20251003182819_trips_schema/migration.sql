-- DropForeignKey
ALTER TABLE "public"."Trip" DROP CONSTRAINT "Trip_airline_id_fkey";

-- CreateTable
CREATE TABLE "public"."Alert" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "depature" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "form_date" TIMESTAMP(3),
    "to_date" TIMESTAMP(3),
    "notificaction" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."Trip" ADD CONSTRAINT "Trip_airline_id_fkey" FOREIGN KEY ("airline_id") REFERENCES "public"."Airline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Alert" ADD CONSTRAINT "Alert_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
