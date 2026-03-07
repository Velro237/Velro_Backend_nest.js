-- Keep defaults aligned with signup logic (EUR by default; XAF only for +237).
ALTER TABLE "User" ALTER COLUMN "currency" SET DEFAULT 'EUR';
ALTER TABLE "Wallet" ALTER COLUMN "currency" SET DEFAULT 'EUR';

-- Backfill users currently stuck on XAF because of old defaults.
UPDATE "User"
SET "currency" = 'EUR'
WHERE "currency" = 'XAF'
  AND (
    "phone" IS NULL
    OR regexp_replace("phone", '\\D', '', 'g') = ''
    OR regexp_replace("phone", '\\D', '', 'g') NOT LIKE '237%'
  );

-- Keep wallet currency in sync for the corrected users.
UPDATE "Wallet" w
SET "currency" = 'EUR'
FROM "User" u
WHERE w."userId" = u."id"
  AND w."currency" = 'XAF'
  AND u."currency" = 'EUR';
