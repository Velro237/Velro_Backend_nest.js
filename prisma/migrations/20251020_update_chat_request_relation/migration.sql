-- DropForeignKey (if exists)
ALTER TABLE "Chat" DROP CONSTRAINT IF EXISTS "Chat_request_id_fkey";

-- AlterTable
ALTER TABLE "Chat" DROP COLUMN IF EXISTS "request_id";

-- AlterTable - Add cancellation fields back if they were removed
ALTER TABLE "TripRequest" ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMP(3);
ALTER TABLE "TripRequest" ADD COLUMN IF NOT EXISTS "cancellation_type" TEXT;
ALTER TABLE "TripRequest" ADD COLUMN IF NOT EXISTS "cancellation_reason" TEXT;

-- AlterTable - Add chat_id
ALTER TABLE "TripRequest" ADD COLUMN IF NOT EXISTS "chat_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "TripRequest_chat_id_key" ON "TripRequest"("chat_id");

-- AddForeignKey
ALTER TABLE "TripRequest" ADD CONSTRAINT "TripRequest_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "Chat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

