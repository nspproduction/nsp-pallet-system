-- Backfill WarehouseOperation records for historical adjustments.
--
-- Before this fix, `adjustStock` created a StockMovement but no WarehouseOperation,
-- so `getWarehouseMovements` couldn't categorize those movements as "ADJUSTMENT"
-- (the dashboard check `warehouseOp.type === 'ADJUSTMENT'` always failed).
--
-- This migration:
--  1. For each orphan adjustment movement (warehouseOpId IS NULL, requestId IS NULL,
--     reason LIKE '[ADJUST]%'), creates a WarehouseOperation record with the same id
--     as the movement's movementGroupId, type=ADJUSTMENT, and reuses the audit log
--     entry (entity='stock_movement', action='adjust') to recover the acting user.
--  2. Links the stock_movement to the new warehouse_operation via warehouseOpId.
--
-- The migration is idempotent: ON CONFLICT DO NOTHING on the INSERT, and the UPDATE
-- only touches rows that still have warehouseOpId IS NULL.

WITH "orphans" AS (
  SELECT
    sm."movementGroupId" AS "id",
    'WO-ADJ-MIG-' || sm."movementGroupId" AS "docNo",
    sm."reason",
    sm."occurredAt" AS "createdAt",
    COALESCE(
      (SELECT al."userId" FROM "audit_logs" al
        WHERE al."entity" = 'stock_movement'
          AND al."entityId" = sm."movementGroupId"
          AND al."action" = 'adjust'
          AND al."userId" IS NOT NULL
        ORDER BY al."createdAt" ASC
        LIMIT 1),
      (SELECT u."id" FROM "users" u
        WHERE 'ADMIN' = ANY(u."roles")
        ORDER BY u."createdAt" ASC
        LIMIT 1)
    ) AS "createdById"
  FROM "stock_movements" sm
  WHERE sm."warehouseOpId" IS NULL
    AND sm."requestId" IS NULL
    AND sm."reason" LIKE '[ADJUST]%'
)
INSERT INTO "warehouse_operations" ("id", "docNo", "type", "reason", "createdById", "createdAt")
SELECT "id", "docNo", 'ADJUSTMENT'::"WarehouseOpType", "reason", "createdById", "createdAt"
FROM "orphans"
WHERE "createdById" IS NOT NULL
ON CONFLICT ("id") DO NOTHING;

UPDATE "stock_movements" sm
SET "warehouseOpId" = sm."movementGroupId"
WHERE sm."warehouseOpId" IS NULL
  AND sm."requestId" IS NULL
  AND sm."reason" LIKE '[ADJUST]%'
  AND EXISTS (
    SELECT 1 FROM "warehouse_operations" wo WHERE wo."id" = sm."movementGroupId"
  );
