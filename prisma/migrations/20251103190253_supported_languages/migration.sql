/*
  Warnings:

  - The values [ES,DE,PT,AR] on the enum `Language` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."Language_new" AS ENUM ('EN', 'FR');
ALTER TABLE "public"."Translation" ALTER COLUMN "language" DROP DEFAULT;
ALTER TABLE "public"."Translation" ALTER COLUMN "language" TYPE "public"."Language_new" USING ("language"::text::"public"."Language_new");
ALTER TYPE "public"."Language" RENAME TO "Language_old";
ALTER TYPE "public"."Language_new" RENAME TO "Language";
DROP TYPE "public"."Language_old";
ALTER TABLE "public"."Translation" ALTER COLUMN "language" SET DEFAULT 'EN';
COMMIT;
