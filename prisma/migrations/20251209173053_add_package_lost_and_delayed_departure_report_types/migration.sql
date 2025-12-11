-- AlterEnum
-- This migration adds new report types for boat shipments
-- PACKAGE_LOST: For "Package was lost or missing during shipment"
-- DELAYED_DEPARTURE: For "Departure or arrival was delayed"

ALTER TYPE "public"."ReportType" ADD VALUE 'PACKAGE_LOST';
ALTER TYPE "public"."ReportType" ADD VALUE 'DELAYED_DEPARTURE';

