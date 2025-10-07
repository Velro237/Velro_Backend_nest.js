-- CreateEnum
CREATE TYPE "public"."ReportType" AS ENUM ('TRAVEL_ISSUES', 'OTHER_ISSUES');

-- CreateEnum
CREATE TYPE "public"."ReportPriority" AS ENUM ('HIGH', 'LOW');

-- CreateEnum
CREATE TYPE "public"."ReportStatus" AS ENUM ('PENDING', 'REPLIED');

-- CreateTable
CREATE TABLE "public"."Report" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "reported_id" TEXT NOT NULL,
    "reply_to_id" TEXT,
    "trip_id" TEXT NOT NULL,
    "request_id" TEXT,
    "type" "public"."ReportType" NOT NULL,
    "text" TEXT,
    "priority" "public"."ReportPriority" NOT NULL,
    "status" "public"."ReportStatus" NOT NULL DEFAULT 'PENDING',
    "data" JSONB,
    "replied_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "images" JSONB,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."Report" ADD CONSTRAINT "Report_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Report" ADD CONSTRAINT "Report_reported_id_fkey" FOREIGN KEY ("reported_id") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Report" ADD CONSTRAINT "Report_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "public"."Report"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Report" ADD CONSTRAINT "Report_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Report" ADD CONSTRAINT "Report_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."TripRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Report" ADD CONSTRAINT "Report_replied_by_fkey" FOREIGN KEY ("replied_by") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
