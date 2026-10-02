-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('REQUESTER', 'APPROVER', 'STORE', 'ADMIN', 'VIEWER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "PalletCondition" AS ENUM ('USABLE', 'IN_REPAIR', 'UNUSABLE');

-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('WAREHOUSE', 'INTERNAL_AREA', 'CUSTOMER', 'REPAIR_SHOP', 'SUPPLIER', 'WRITE_OFF');

-- CreateEnum
CREATE TYPE "RequestType" AS ENUM ('RECEIVE_NEW', 'ISSUE_INTERNAL', 'RETURN_INTERNAL', 'SHIP_CUSTOMER', 'RETURN_CUSTOMER', 'SEND_REPAIR', 'RECEIVE_REPAIR', 'WRITE_OFF', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'FULFILLED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "StoreActionType" AS ENUM ('CONFIRM_DISPATCH', 'CONFIRM_RECEIPT');

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "lineUserId" TEXT,
    "employeeCode" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'REQUESTER',
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
    "departmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pallet_types" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "material" TEXT,
    "sizeSpec" TEXT,
    "minStock" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pallet_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "LocationType" NOT NULL,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "address" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requests" (
    "id" TEXT NOT NULL,
    "docNo" TEXT NOT NULL,
    "type" "RequestType" NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "requesterId" TEXT NOT NULL,
    "fromLocationId" TEXT,
    "toLocationId" TEXT,
    "neededDate" TIMESTAMP(3),
    "purpose" TEXT,
    "referenceNo" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "fulfilledAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_items" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "palletTypeId" TEXT NOT NULL,
    "condition" "PalletCondition" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "actualQuantity" INTEGER,
    "note" TEXT,

    CONSTRAINT "request_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approvals" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "decision" "ApprovalDecision" NOT NULL,
    "comment" TEXT,
    "step" INTEGER NOT NULL DEFAULT 1,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_actions" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "StoreActionType" NOT NULL,
    "comment" TEXT,
    "actedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "movementGroupId" TEXT NOT NULL,
    "requestId" TEXT,
    "palletTypeId" TEXT NOT NULL,
    "condition" "PalletCondition" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "fromLocationId" TEXT,
    "toLocationId" TEXT,
    "reason" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileType" TEXT,
    "fileSize" INTEGER,
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "linkUrl" TEXT,
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

-- CreateIndex
CREATE UNIQUE INDEX "users_lineUserId_key" ON "users"("lineUserId");

-- CreateIndex
CREATE UNIQUE INDEX "users_employeeCode_key" ON "users"("employeeCode");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_status_idx" ON "users"("role", "status");

-- CreateIndex
CREATE UNIQUE INDEX "pallet_types_code_key" ON "pallet_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "locations_code_key" ON "locations"("code");

-- CreateIndex
CREATE INDEX "locations_type_active_idx" ON "locations"("type", "active");

-- CreateIndex
CREATE UNIQUE INDEX "requests_docNo_key" ON "requests"("docNo");

-- CreateIndex
CREATE INDEX "requests_status_type_idx" ON "requests"("status", "type");

-- CreateIndex
CREATE INDEX "requests_requesterId_status_idx" ON "requests"("requesterId", "status");

-- CreateIndex
CREATE INDEX "requests_createdAt_idx" ON "requests"("createdAt");

-- CreateIndex
CREATE INDEX "request_items_requestId_idx" ON "request_items"("requestId");

-- CreateIndex
CREATE INDEX "approvals_requestId_idx" ON "approvals"("requestId");

-- CreateIndex
CREATE INDEX "store_actions_requestId_idx" ON "store_actions"("requestId");

-- CreateIndex
CREATE INDEX "stock_movements_palletTypeId_condition_idx" ON "stock_movements"("palletTypeId", "condition");

-- CreateIndex
CREATE INDEX "stock_movements_fromLocationId_idx" ON "stock_movements"("fromLocationId");

-- CreateIndex
CREATE INDEX "stock_movements_toLocationId_idx" ON "stock_movements"("toLocationId");

-- CreateIndex
CREATE INDEX "stock_movements_occurredAt_idx" ON "stock_movements"("occurredAt");

-- CreateIndex
CREATE INDEX "attachments_requestId_idx" ON "attachments"("requestId");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entityId_idx" ON "audit_logs"("entity", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_createdAt_idx" ON "audit_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_fromLocationId_fkey" FOREIGN KEY ("fromLocationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_toLocationId_fkey" FOREIGN KEY ("toLocationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_items" ADD CONSTRAINT "request_items_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_items" ADD CONSTRAINT "request_items_palletTypeId_fkey" FOREIGN KEY ("palletTypeId") REFERENCES "pallet_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_actions" ADD CONSTRAINT "store_actions_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_actions" ADD CONSTRAINT "store_actions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_palletTypeId_fkey" FOREIGN KEY ("palletTypeId") REFERENCES "pallet_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_fromLocationId_fkey" FOREIGN KEY ("fromLocationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_toLocationId_fkey" FOREIGN KEY ("toLocationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
