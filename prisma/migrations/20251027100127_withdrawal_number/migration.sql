-- CreateTable
CREATE TABLE "public"."WithdrawalNumber" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "carrier" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "WithdrawalNumber_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WithdrawalNumber_number_key" ON "public"."WithdrawalNumber"("number");

-- AddForeignKey
ALTER TABLE "public"."WithdrawalNumber" ADD CONSTRAINT "WithdrawalNumber_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
