-- Remove STORE role & fulfillment step.
-- Model now goes: PENDING -> APPROVED (stock materialized at approve time).

-- 1. Delete users with role=STORE (also removes their notifications, audit logs references via SET NULL).
DELETE FROM "users" WHERE "role" = 'STORE';

-- 2. Drop store_actions table and its enum.
DROP TABLE IF EXISTS "store_actions";
DROP TYPE  IF EXISTS "StoreActionType";

-- 3. Collapse any FULFILLED requests into APPROVED (should normally be empty if no fulfillments existed).
UPDATE "requests" SET "status" = 'APPROVED' WHERE "status" = 'FULFILLED';

-- 4. Drop fulfilledAt column.
ALTER TABLE "requests" DROP COLUMN IF EXISTS "fulfilledAt";

-- 5. Drop actualQuantity column from request_items.
ALTER TABLE "request_items" DROP COLUMN IF EXISTS "actualQuantity";

-- 6. Recreate enums without the removed values. Postgres doesn't allow removing enum values in-place,
--    so we rename-old / create-new / cast / drop-old.
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
CREATE TYPE "UserRole" AS ENUM ('REQUESTER', 'APPROVER', 'ADMIN', 'VIEWER');
ALTER TABLE "users"
  ALTER COLUMN "role" DROP DEFAULT,
  ALTER COLUMN "role" TYPE "UserRole" USING "role"::text::"UserRole",
  ALTER COLUMN "role" SET DEFAULT 'REQUESTER';
DROP TYPE "UserRole_old";

ALTER TYPE "RequestStatus" RENAME TO "RequestStatus_old";
CREATE TYPE "RequestStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
ALTER TABLE "requests"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "RequestStatus" USING "status"::text::"RequestStatus",
  ALTER COLUMN "status" SET DEFAULT 'PENDING';
DROP TYPE "RequestStatus_old";
