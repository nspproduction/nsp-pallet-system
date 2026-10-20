-- Make employeeCode nullable (optional for users who register without an employee code)
ALTER TABLE "users" ALTER COLUMN "employeeCode" DROP NOT NULL;
