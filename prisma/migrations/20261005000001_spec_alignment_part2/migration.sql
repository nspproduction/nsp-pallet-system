-- Migration part 2/2: Use new enum values, update tables, add new tables

-- ─── 0. departments: add active column (missing from init) ───────────────────
ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;

-- ─── 0a. Create department_sections table (never created in any prior migration)
CREATE TABLE IF NOT EXISTS "department_sections" (
  "id"           TEXT         NOT NULL,
  "departmentId" TEXT         NOT NULL,
  "name"         TEXT         NOT NULL,
  "code"         TEXT,
  "active"       BOOLEAN      NOT NULL DEFAULT true,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "department_sections_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "department_sections_departmentId_code_key" UNIQUE ("departmentId", "code"),
  CONSTRAINT "department_sections_departmentId_fkey"
    FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- ─── 0b. users: add sectionId FK ─────────────────────────────────────────────
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "sectionId" TEXT;
ALTER TABLE "users"
  ADD CONSTRAINT "users_sectionId_fkey"
  FOREIGN KEY ("sectionId") REFERENCES "department_sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── 1. Migrate existing RequestType data ────────────────────────────────────
UPDATE "requests"        SET "type"        = 'ISSUE'  WHERE "type"::text        = 'ISSUE_INTERNAL';
UPDATE "requests"        SET "type"        = 'RETURN' WHERE "type"::text        = 'RETURN_INTERNAL';
UPDATE "approval_routes" SET "requestType" = 'ISSUE'  WHERE "requestType"::text = 'ISSUE_INTERNAL';
UPDATE "approval_routes" SET "requestType" = 'RETURN' WHERE "requestType"::text = 'RETURN_INTERNAL';

-- Recreate RequestType as ISSUE/RETURN only
CREATE TYPE "RequestType_v2" AS ENUM ('ISSUE', 'RETURN');
ALTER TABLE "requests"        ALTER COLUMN "type"        TYPE "RequestType_v2" USING "type"::text::"RequestType_v2";
ALTER TABLE "approval_routes" ALTER COLUMN "requestType" TYPE "RequestType_v2" USING "requestType"::text::"RequestType_v2";
DROP TYPE "RequestType";
ALTER TYPE "RequestType_v2" RENAME TO "RequestType";

-- ─── 2. Replace RequestStatus enum (drop legacy PENDING / APPROVED) ──────────
CREATE TYPE "RequestStatus_v2" AS ENUM (
  'DRAFT', 'PENDING_DEPT', 'PENDING_WAREHOUSE', 'COMPLETED', 'REJECTED', 'CANCELLED'
);
-- Drop default first so the column type cast does not fail on incompatible default
ALTER TABLE "requests" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "requests" ALTER COLUMN "status" TYPE "RequestStatus_v2"
  USING CASE
    WHEN "status"::text = 'PENDING'  THEN 'PENDING_DEPT'::"RequestStatus_v2"
    WHEN "status"::text = 'APPROVED' THEN 'COMPLETED'::"RequestStatus_v2"
    ELSE "status"::text::"RequestStatus_v2"
  END;
ALTER TABLE "requests" ALTER COLUMN "status" SET DEFAULT 'PENDING_DEPT'::"RequestStatus_v2";
DROP TYPE "RequestStatus";
ALTER TYPE "RequestStatus_v2" RENAME TO "RequestStatus";

-- ─── 3. users: role → roles array, drop lineUserId, add username ─────────────
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "roles"    "UserRole"[];
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username" TEXT;
UPDATE "users" SET "roles" = ARRAY["role"::"UserRole"] WHERE "roles" IS NULL;
ALTER TABLE "users" ALTER COLUMN "roles" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "roles" SET DEFAULT ARRAY['REQUESTER'::"UserRole"];
ALTER TABLE "users" DROP COLUMN IF EXISTS "role";
ALTER TABLE "users" DROP COLUMN IF EXISTS "lineUserId";

-- ─── 4. requests: add condition column ───────────────────────────────────────
ALTER TABLE "requests" ADD COLUMN IF NOT EXISTS "condition"          "PalletCondition";
ALTER TABLE "requests" ADD COLUMN IF NOT EXISTS "departmentId"       TEXT;
ALTER TABLE "requests" ADD COLUMN IF NOT EXISTS "requesterSectionId" TEXT;

UPDATE "requests" r
SET    "condition" = (
         SELECT ri."condition" FROM "request_items" ri
         WHERE  ri."requestId" = r."id"
         LIMIT  1
       )
WHERE  r."condition" IS NULL;

ALTER TABLE "requests" DROP COLUMN IF EXISTS "approvedAt";

-- ─── 5. request_items: drop per-item condition (now on Request) ───────────────
ALTER TABLE "request_items" DROP COLUMN IF EXISTS "condition";

-- ─── 6. pallet_types: rename minStock → reorderPoint ────────────────────────
ALTER TABLE "pallet_types" ADD COLUMN IF NOT EXISTS "reorderPoint" INTEGER NOT NULL DEFAULT 0;
UPDATE "pallet_types" SET "reorderPoint" = COALESCE("minStock", 0);
ALTER TABLE "pallet_types" DROP COLUMN IF EXISTS "minStock";

-- ─── 7. Create warehouse_operations table ────────────────────────────────────
CREATE TABLE IF NOT EXISTS "warehouse_operations" (
  "id"          TEXT             NOT NULL,
  "docNo"       TEXT             NOT NULL,
  "type"        "WarehouseOpType" NOT NULL,
  "reason"      TEXT,
  "createdById" TEXT             NOT NULL,
  "createdAt"   TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "warehouse_operations_pkey"        PRIMARY KEY ("id"),
  CONSTRAINT "warehouse_operations_docNo_key"   UNIQUE ("docNo"),
  CONSTRAINT "warehouse_operations_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id")
);
CREATE INDEX IF NOT EXISTS "warehouse_operations_type_createdAt_idx"
  ON "warehouse_operations"("type", "createdAt");

-- ─── 8. Create warehouse_operation_items table ───────────────────────────────
CREATE TABLE IF NOT EXISTS "warehouse_operation_items" (
  "id"            TEXT              NOT NULL,
  "operationId"   TEXT              NOT NULL,
  "palletTypeId"  TEXT              NOT NULL,
  "fromCondition" "PalletCondition",
  "toCondition"   "PalletCondition",
  "quantity"      INTEGER           NOT NULL,
  CONSTRAINT "warehouse_operation_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "warehouse_operation_items_operationId_fkey"
    FOREIGN KEY ("operationId") REFERENCES "warehouse_operations"("id") ON DELETE CASCADE,
  CONSTRAINT "warehouse_operation_items_palletTypeId_fkey"
    FOREIGN KEY ("palletTypeId") REFERENCES "pallet_types"("id")
);
CREATE INDEX IF NOT EXISTS "warehouse_operation_items_operationId_idx"
  ON "warehouse_operation_items"("operationId");

-- ─── 8a. stock_movements: replace location columns with department columns ────
ALTER TABLE "stock_movements" DROP CONSTRAINT IF EXISTS "stock_movements_fromLocationId_fkey";
ALTER TABLE "stock_movements" DROP CONSTRAINT IF EXISTS "stock_movements_toLocationId_fkey";
DROP INDEX IF EXISTS "stock_movements_fromLocationId_idx";
DROP INDEX IF EXISTS "stock_movements_toLocationId_idx";
ALTER TABLE "stock_movements" DROP COLUMN IF EXISTS "fromLocationId";
ALTER TABLE "stock_movements" DROP COLUMN IF EXISTS "toLocationId";
ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "fromDepartmentId" TEXT;
ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "fromSectionId"    TEXT;
ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "toDepartmentId"   TEXT;
ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "toSectionId"      TEXT;
CREATE INDEX IF NOT EXISTS "stock_movements_fromDepartmentId_idx" ON "stock_movements"("fromDepartmentId");
CREATE INDEX IF NOT EXISTS "stock_movements_toDepartmentId_idx"   ON "stock_movements"("toDepartmentId");
ALTER TABLE "stock_movements"
  ADD CONSTRAINT "stock_movements_fromDepartmentId_fkey"
  FOREIGN KEY ("fromDepartmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stock_movements"
  ADD CONSTRAINT "stock_movements_toDepartmentId_fkey"
  FOREIGN KEY ("toDepartmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stock_movements"
  ADD CONSTRAINT "stock_movements_fromSectionId_fkey"
  FOREIGN KEY ("fromSectionId") REFERENCES "department_sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stock_movements"
  ADD CONSTRAINT "stock_movements_toSectionId_fkey"
  FOREIGN KEY ("toSectionId") REFERENCES "department_sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── 8b. requests: replace location columns with department columns ───────────
ALTER TABLE "requests" DROP CONSTRAINT IF EXISTS "requests_fromLocationId_fkey";
ALTER TABLE "requests" DROP CONSTRAINT IF EXISTS "requests_toLocationId_fkey";
ALTER TABLE "requests" DROP COLUMN IF EXISTS "fromLocationId";
ALTER TABLE "requests" DROP COLUMN IF EXISTS "toLocationId";
ALTER TABLE "requests" ADD COLUMN IF NOT EXISTS "fromDepartmentId" TEXT;
ALTER TABLE "requests" ADD COLUMN IF NOT EXISTS "fromSectionId"    TEXT;
ALTER TABLE "requests" ADD COLUMN IF NOT EXISTS "toDepartmentId"   TEXT;
ALTER TABLE "requests" ADD COLUMN IF NOT EXISTS "toSectionId"      TEXT;
ALTER TABLE "requests" ADD COLUMN IF NOT EXISTS "sectionId"        TEXT;
ALTER TABLE "requests"
  ADD CONSTRAINT "requests_fromDepartmentId_fkey"
  FOREIGN KEY ("fromDepartmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "requests"
  ADD CONSTRAINT "requests_toDepartmentId_fkey"
  FOREIGN KEY ("toDepartmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "requests"
  ADD CONSTRAINT "requests_fromSectionId_fkey"
  FOREIGN KEY ("fromSectionId") REFERENCES "department_sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "requests"
  ADD CONSTRAINT "requests_toSectionId_fkey"
  FOREIGN KEY ("toSectionId") REFERENCES "department_sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "requests"
  ADD CONSTRAINT "requests_requesterSectionId_fkey"
  FOREIGN KEY ("requesterSectionId") REFERENCES "department_sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── 9. Create warehouse_stock snapshot table ─────────────────────────────────
CREATE TABLE IF NOT EXISTS "warehouse_stock" (
  "palletTypeId" TEXT              NOT NULL,
  "condition"    "PalletCondition" NOT NULL,
  "quantity"     INTEGER           NOT NULL DEFAULT 0,
  CONSTRAINT "warehouse_stock_pkey" PRIMARY KEY ("palletTypeId", "condition"),
  CONSTRAINT "warehouse_stock_palletTypeId_fkey"
    FOREIGN KEY ("palletTypeId") REFERENCES "pallet_types"("id")
);

-- Seed warehouse_stock from existing stock_movements
INSERT INTO "warehouse_stock" ("palletTypeId", "condition", "quantity")
SELECT
  "palletTypeId",
  "condition",
  COALESCE(SUM(CASE WHEN "toDepartmentId"   IS NOT NULL THEN "quantity" ELSE 0 END), 0)
  - COALESCE(SUM(CASE WHEN "fromDepartmentId" IS NOT NULL THEN "quantity" ELSE 0 END), 0)
FROM "stock_movements"
GROUP BY "palletTypeId", "condition"
ON CONFLICT ("palletTypeId", "condition")
  DO UPDATE SET "quantity" = EXCLUDED."quantity";

-- ─── 10. stock_movements: add warehouseOpId FK ───────────────────────────────
ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "warehouseOpId" TEXT;
ALTER TABLE "stock_movements"
  ADD CONSTRAINT "stock_movements_warehouseOpId_fkey"
  FOREIGN KEY ("warehouseOpId") REFERENCES "warehouse_operations"("id");

-- ─── 11. notifications: align to new model ────────────────────────────────────
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "requestId" TEXT;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "readAt"    TIMESTAMP(3);
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "linkUrl"   TEXT;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "subject"   TEXT;
ALTER TABLE "notifications" DROP COLUMN IF EXISTS "channel";
ALTER TABLE "notifications" DROP COLUMN IF EXISTS "sentAt";
ALTER TABLE "notifications" DROP COLUMN IF EXISTS "error";
