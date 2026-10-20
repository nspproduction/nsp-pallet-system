-- Add isWarehouse flag, backfill warehouse dept, then drop code column

ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "isWarehouse" BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE "departments" SET "isWarehouse" = TRUE WHERE "code" = 'WH-PL';

ALTER TABLE "departments" DROP CONSTRAINT IF EXISTS "departments_code_key";

ALTER TABLE "departments" DROP COLUMN IF EXISTS "code";
