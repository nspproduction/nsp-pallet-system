-- Migration: remove SUPER_ADMIN role
-- 1. Promote any existing SUPER_ADMIN users to ADMIN
-- 2. Recreate the UserRole enum without SUPER_ADMIN

-- Step 1: replace SUPER_ADMIN with ADMIN in every user's roles array
UPDATE "users"
SET "roles" = array_replace("roles", 'SUPER_ADMIN'::"UserRole", 'ADMIN'::"UserRole")
WHERE 'SUPER_ADMIN' = ANY("roles");

-- Step 2: drop the default so it doesn't block the type swap
ALTER TABLE "users" ALTER COLUMN "roles" DROP DEFAULT;

-- Step 3: recreate enum without SUPER_ADMIN
CREATE TYPE "UserRole_new" AS ENUM ('REQUESTER', 'DEPT_APPROVER', 'PALLET_MANAGER', 'VIEWER', 'ADMIN');

ALTER TABLE "users"
  ALTER COLUMN "roles" TYPE "UserRole_new"[]
  USING "roles"::text::"UserRole_new"[];

DROP TYPE "UserRole";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";

-- Step 4: restore the default with the new type
ALTER TABLE "users" ALTER COLUMN "roles" SET DEFAULT ARRAY['REQUESTER'::"UserRole"];
