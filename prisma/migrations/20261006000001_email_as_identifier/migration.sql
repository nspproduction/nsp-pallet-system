-- Use email as the sole login identifier.
-- Drop username and employeeCode columns.
ALTER TABLE "users" DROP COLUMN IF EXISTS "username";
ALTER TABLE "users" DROP COLUMN IF EXISTS "employeeCode";

-- Make email NOT NULL (fill any legacy NULLs with a placeholder before constraint is added)
UPDATE "users" SET email = id || '@placeholder.local' WHERE email IS NULL;
ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL;
