-- Rebuild department_stock from the stock_movements ledger (CLAUDE.md Rule 1/2:
-- stock_movements is append-only and authoritative). The 20261017174021 migration
-- created department_stock without a backfill, so systems that had movement history
-- before that migration have empty / stale department_stock. Running this migration
-- is safe because department_stock is derivable from stock_movements and this script
-- recomputes it from scratch.

DELETE FROM "department_stock";

INSERT INTO "department_stock" ("palletTypeId", "condition", "departmentId", "quantity")
SELECT
  "palletTypeId",
  "condition",
  "departmentId",
  SUM("delta")::INT AS quantity
FROM (
  SELECT "palletTypeId", "condition", "toDepartmentId" AS "departmentId", "quantity" AS "delta"
  FROM "stock_movements"
  WHERE "toDepartmentId" IS NOT NULL
  UNION ALL
  SELECT "palletTypeId", "condition", "fromDepartmentId" AS "departmentId", -"quantity" AS "delta"
  FROM "stock_movements"
  WHERE "fromDepartmentId" IS NOT NULL
) AS "deltas"
GROUP BY "palletTypeId", "condition", "departmentId"
HAVING SUM("delta") <> 0;
