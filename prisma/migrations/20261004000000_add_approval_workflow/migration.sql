-- M3: Add approval workflow, operating hours, email outbox, password reset tokens

-- AlterTable users: add email, login protection, new relations
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3);

-- AlterTable pallet_types: add explicit dimension columns
ALTER TABLE "pallet_types" ADD COLUMN IF NOT EXISTS "widthCm" INTEGER;
ALTER TABLE "pallet_types" ADD COLUMN IF NOT EXISTS "lengthCm" INTEGER;

-- AlterTable requests: add urgent + multi-step approval fields
ALTER TABLE "requests" ADD COLUMN IF NOT EXISTS "isUrgent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "requests" ADD COLUMN IF NOT EXISTS "urgentReason" TEXT;
ALTER TABLE "requests" ADD COLUMN IF NOT EXISTS "currentStepOrder" INTEGER;
ALTER TABLE "requests" ADD COLUMN IF NOT EXISTS "stepSnapshot" JSONB;
ALTER TABLE "requests" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);

-- AlterTable approvals: add step tracking
ALTER TABLE "approvals" ADD COLUMN IF NOT EXISTS "stepName" TEXT;

-- AlterEnum RequestStatus: add new values (PostgreSQL allows ADD VALUE only)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'PENDING_DEPT' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'RequestStatus')) THEN
    ALTER TYPE "RequestStatus" ADD VALUE 'PENDING_DEPT';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'PENDING_WAREHOUSE' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'RequestStatus')) THEN
    ALTER TYPE "RequestStatus" ADD VALUE 'PENDING_WAREHOUSE';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'COMPLETED' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'RequestStatus')) THEN
    ALTER TYPE "RequestStatus" ADD VALUE 'COMPLETED';
  END IF;
END $$;

-- CreateEnum EmailStatus
DO $$ BEGIN
  CREATE TYPE "EmailStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable approval_routes
CREATE TABLE IF NOT EXISTS "approval_routes" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "requestType" "RequestType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "approval_routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable approval_steps
CREATE TABLE IF NOT EXISTS "approval_steps" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "approverIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    CONSTRAINT "approval_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable request_revisions
CREATE TABLE IF NOT EXISTS "request_revisions" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "editedById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "request_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable operating_hours
CREATE TABLE IF NOT EXISTS "operating_hours" (
    "id" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "label" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "operating_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable holiday_dates
CREATE TABLE IF NOT EXISTS "holiday_dates" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "holiday_dates_pkey" PRIMARY KEY ("id")
);

-- CreateTable password_reset_tokens
CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable email_outbox
CREATE TABLE IF NOT EXISTS "email_outbox" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "status" "EmailStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    CONSTRAINT "email_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "approval_routes_departmentId_requestType_key" ON "approval_routes"("departmentId", "requestType");
CREATE UNIQUE INDEX IF NOT EXISTS "approval_steps_routeId_stepOrder_key" ON "approval_steps"("routeId", "stepOrder");
CREATE INDEX IF NOT EXISTS "approval_steps_routeId_idx" ON "approval_steps"("routeId");
CREATE INDEX IF NOT EXISTS "request_revisions_requestId_idx" ON "request_revisions"("requestId");
CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_tokens_tokenHash_key" ON "password_reset_tokens"("tokenHash");
CREATE INDEX IF NOT EXISTS "password_reset_tokens_userId_idx" ON "password_reset_tokens"("userId");
CREATE INDEX IF NOT EXISTS "email_outbox_status_createdAt_idx" ON "email_outbox"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "approval_routes" DROP CONSTRAINT IF EXISTS "approval_routes_departmentId_fkey";
ALTER TABLE "approval_routes" ADD CONSTRAINT "approval_routes_departmentId_fkey"
    FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "approval_steps" DROP CONSTRAINT IF EXISTS "approval_steps_routeId_fkey";
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_routeId_fkey"
    FOREIGN KEY ("routeId") REFERENCES "approval_routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "request_revisions" DROP CONSTRAINT IF EXISTS "request_revisions_requestId_fkey";
ALTER TABLE "request_revisions" ADD CONSTRAINT "request_revisions_requestId_fkey"
    FOREIGN KEY ("requestId") REFERENCES "requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "request_revisions" DROP CONSTRAINT IF EXISTS "request_revisions_editedById_fkey";
ALTER TABLE "request_revisions" ADD CONSTRAINT "request_revisions_editedById_fkey"
    FOREIGN KEY ("editedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "password_reset_tokens" DROP CONSTRAINT IF EXISTS "password_reset_tokens_userId_fkey";
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
