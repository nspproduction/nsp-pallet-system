-- Drop the unused UserStatus.REJECTED enum value.
--
-- The REJECTED status was defined on UserStatus but never set by any code path
-- (`reject()` in the admin UI sets status to 'DISABLED', not 'REJECTED').
--
-- Postgres doesn't support `ALTER TYPE ... DROP VALUE`, so we rename-and-recreate:
--  1. Map any stray REJECTED rows to DISABLED (defensive).
--  2. Rename the old enum, create a new one without REJECTED.
--  3. Switch the column to the new type.
--  4. Drop the old enum.

-- 1. Defensive: migrate any legacy REJECTED rows to DISABLED
UPDATE "users" SET "status" = 'DISABLED' WHERE "status" = 'REJECTED';

-- 2. Rename old enum
ALTER TYPE "UserStatus" RENAME TO "UserStatus_old";

-- 3. Create new enum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'DISABLED');

-- 4. Switch column type (temporarily drop default to avoid cast error)
ALTER TABLE "users" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "users"
  ALTER COLUMN "status" TYPE "UserStatus"
  USING "status"::text::"UserStatus";
ALTER TABLE "users" ALTER COLUMN "status" SET DEFAULT 'PENDING'::"UserStatus";

-- 5. Drop old enum
DROP TYPE "UserStatus_old";
