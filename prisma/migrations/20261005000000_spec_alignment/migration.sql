-- Migration part 1/2: ADD VALUE only
-- PostgreSQL requires enum ADD VALUE to be committed before the new values can be used.

-- Rename existing PalletCondition values (safe to use immediately)
ALTER TYPE "PalletCondition" RENAME VALUE 'USABLE'   TO 'GOOD';
ALTER TYPE "PalletCondition" RENAME VALUE 'IN_REPAIR' TO 'PENDING_REPAIR';
ALTER TYPE "PalletCondition" RENAME VALUE 'UNUSABLE'  TO 'DAMAGED';

-- Add new UserRole values
ALTER TYPE "UserRole" RENAME VALUE 'APPROVER' TO 'DEPT_APPROVER';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'PALLET_MANAGER';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';

-- Add REJECTED to UserStatus
ALTER TYPE "UserStatus" ADD VALUE IF NOT EXISTS 'REJECTED';

-- Add new RequestType values (cannot be used until this migration commits)
ALTER TYPE "RequestType" ADD VALUE IF NOT EXISTS 'ISSUE';
ALTER TYPE "RequestType" ADD VALUE IF NOT EXISTS 'RETURN';

-- Add EDIT_APPROVED to ApprovalDecision
ALTER TYPE "ApprovalDecision" ADD VALUE IF NOT EXISTS 'EDIT_APPROVED';

-- Create WarehouseOpType enum (new, safe to create here)
DO $$ BEGIN
  CREATE TYPE "WarehouseOpType" AS ENUM ('NEW_STOCK', 'REPAIR_RESULT', 'WRITE_OFF', 'ADJUSTMENT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
