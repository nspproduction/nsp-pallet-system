/**
 * lib/server/stock/index.ts
 *
 * SINGLE entry point for ALL warehouse stock changes (CLAUDE.md Rule 1).
 * Every call must happen inside a prisma.$transaction.
 *
 * Uses a conditional UPDATE to prevent negative balances (CLAUDE.md Rule 3, AC-9):
 *   UPDATE warehouse_stock SET quantity = quantity + delta
 *   WHERE palletTypeId = X AND condition = Y AND quantity + delta >= 0
 * If 0 rows updated → balance too low → throw HttpError(400).
 */

import type { PrismaClient } from "@prisma/client";
import type { PalletCondition } from "@prisma/client";
import { HttpError } from "@/lib/auth/current-user";

// Prisma transaction client type (available from Prisma 5+)
type TxClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

export interface MoveStockParams {
  palletTypeId: string;
  condition: PalletCondition;
  /** Positive = inflow to warehouse, negative = outflow from warehouse */
  delta: number;
  fromDepartmentId?: string | null;
  toDepartmentId?: string | null;
  fromSectionId?: string | null;
  toSectionId?: string | null;
  reason?: string | null;
  requestId?: string | null;
  warehouseOpId?: string | null;
  movementGroupId?: string;
  occurredAt?: Date;
}

/**
 * Move stock in the warehouse and update the WarehouseStock snapshot atomically.
 *
 * Must be called inside prisma.$transaction. Throws HttpError(400) if the
 * resulting balance would go below zero (conditional-update pattern — no race condition).
 */
export async function moveStock(tx: TxClient, params: MoveStockParams): Promise<void> {
  const {
    palletTypeId,
    condition,
    delta,
    fromDepartmentId,
    fromSectionId,
    toDepartmentId,
    toSectionId,
    requestId,
    warehouseOpId,
    movementGroupId,
    occurredAt,
    reason
  } = params;

  if (delta === 0) return;

  // 1. Append ledger entry (append-only — never update/delete per CLAUDE.md Rule 2)
  await tx.stockMovement.create({
    data: {
      ...(movementGroupId ? { movementGroupId } : {}),
      palletTypeId,
      condition,
      quantity: Math.abs(delta),
      fromDepartmentId: fromDepartmentId ?? null,
      fromSectionId: fromSectionId ?? null,
      toDepartmentId: toDepartmentId ?? null,
      toSectionId: toSectionId ?? null,
      requestId: requestId ?? null,
      warehouseOpId: warehouseOpId ?? null,
      reason: reason ?? null,
      occurredAt: occurredAt ?? new Date()
    }
  });

  // 2. Update WarehouseStock snapshot
  if (delta > 0) {
    // Inflow — always safe; upsert row
    await tx.$executeRaw`
      INSERT INTO warehouse_stock ("palletTypeId", condition, quantity)
      VALUES (${palletTypeId}, ${condition}::"PalletCondition", ${delta})
      ON CONFLICT ("palletTypeId", condition)
      DO UPDATE SET quantity = warehouse_stock.quantity + ${delta}
    `;
  } else {
    // Outflow — conditional update prevents negative balance (Rule 3, AC-9)
    const removed = Math.abs(delta);
    const rowsAffected: number = await tx.$executeRaw`
      UPDATE warehouse_stock
      SET    quantity = quantity - ${removed}
      WHERE  "palletTypeId" = ${palletTypeId}
        AND  condition      = ${condition}::"PalletCondition"
        AND  quantity      >= ${removed}
    `;
    if (rowsAffected === 0) {
      const snap = await tx.warehouseStock.findUnique({
        where: { palletTypeId_condition: { palletTypeId, condition } }
      });
      const avail = snap?.quantity ?? 0;
      throw new HttpError(400, `ยอด ${condition} ในคลังไม่พอ (มี ${avail} ใบ, ต้องการ ${removed} ใบ)`);
    }
  }

  // 3. Update DepartmentStock snapshot (BR-3: allows negative for returns)
  const qty = Math.abs(delta);
  if (toDepartmentId) {
    await tx.$executeRaw`
      INSERT INTO department_stock ("palletTypeId", condition, "departmentId", quantity)
      VALUES (${palletTypeId}, ${condition}::"PalletCondition", ${toDepartmentId}, ${qty})
      ON CONFLICT ("palletTypeId", condition, "departmentId")
      DO UPDATE SET quantity = department_stock.quantity + ${qty}
    `;
  }
  if (fromDepartmentId) {
    await tx.$executeRaw`
      INSERT INTO department_stock ("palletTypeId", condition, "departmentId", quantity)
      VALUES (${palletTypeId}, ${condition}::"PalletCondition", ${fromDepartmentId}, ${-qty})
      ON CONFLICT ("palletTypeId", condition, "departmentId")
      DO UPDATE SET quantity = department_stock.quantity - ${qty}
    `;
  }
}
