import { randomUUID } from "node:crypto";
import type { PalletCondition } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/auth/current-user";
import type { SessionUser } from "@/lib/auth/current-user";
import { writeAudit } from "@/lib/services/audit";
import { moveStock } from "@/lib/server/stock";
import { nextWarehouseOpDocNo } from "@/lib/services/docno";

async function getWarehouse() {
  const d = await prisma.department.findFirst({ where: { isWarehouse: true } });
  if (!d || !d.active) throw new HttpError(500, "ยังไม่ได้ตั้งค่าแผนกคลังพาเลท (isWarehouse = true)");
  return d;
}

function requirePalletManager(user: SessionUser) {
  if (!user.roles.some((r) => ["PALLET_MANAGER", "ADMIN"].includes(r))) {
    throw new HttpError(403, "เฉพาะ Pallet Manager หรือ Admin เท่านั้น");
  }
}

// ─── Repair result ────────────────────────────────────────────────────────────
// PENDING_REPAIR → GOOD (repaired) and/or DAMAGED (beyond repair)
export async function repairPallets(user: SessionUser, input: { palletTypeId: string; repairedQty: number; damagedQty: number; note?: string }) {
  requirePalletManager(user);
  const total = (input.repairedQty ?? 0) + (input.damagedQty ?? 0);
  if (total <= 0) throw new HttpError(400, "ต้องระบุจำนวนซ่อมได้หรือซ่อมไม่ได้อย่างน้อย 1");
  if (input.repairedQty < 0 || input.damagedQty < 0) throw new HttpError(400, "จำนวนต้อง ≥ 0");

  const warehouse = await getWarehouse();
  const groupId = randomUUID();
  const docNo = await nextWarehouseOpDocNo("REPAIR_RESULT");
  const reason = `[REPAIR]${input.note ? ` ${input.note}` : ""}`;
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    // Create WarehouseOperation header
    await tx.warehouseOperation.create({
      data: { id: groupId, docNo, type: "REPAIR_RESULT", reason, createdById: user.id, createdAt: now }
    });

    // PENDING_REPAIR out (conditional — throws if insufficient)
    await moveStock(tx, {
      palletTypeId: input.palletTypeId,
      condition: "PENDING_REPAIR",
      delta: -total,
      fromDepartmentId: warehouse.id,
      warehouseOpId: groupId,
      movementGroupId: groupId,
      reason,
      occurredAt: now
    });

    if (input.repairedQty > 0) {
      await moveStock(tx, {
        palletTypeId: input.palletTypeId,
        condition: "GOOD",
        delta: input.repairedQty,
        toDepartmentId: warehouse.id,
        warehouseOpId: groupId,
        movementGroupId: groupId,
        reason,
        occurredAt: now
      });
    }
    if (input.damagedQty > 0) {
      await moveStock(tx, {
        palletTypeId: input.palletTypeId,
        condition: "DAMAGED",
        delta: input.damagedQty,
        toDepartmentId: warehouse.id,
        warehouseOpId: groupId,
        movementGroupId: groupId,
        reason,
        occurredAt: now
      });
    }
  });

  await writeAudit({
    userId: user.id,
    entity: "warehouse_operation",
    entityId: groupId,
    action: "repair",
    after: { ...input, total, warehouseOpId: groupId }
  });

  return { warehouseOpId: groupId, total, repairedQty: input.repairedQty, damagedQty: input.damagedQty };
}

// ─── Write off ────────────────────────────────────────────────────────────────
export async function writeOffPallets(
  user: SessionUser,
  input: { palletTypeId: string; condition: PalletCondition; quantity: number; note: string }
) {
  requirePalletManager(user);
  if (input.quantity <= 0) throw new HttpError(400, "quantity ต้อง > 0");
  if (!input.note?.trim()) throw new HttpError(400, "ต้องระบุเหตุผลการตัดจำหน่าย");

  const warehouse = await getWarehouse();
  const docNo = await nextWarehouseOpDocNo("WRITE_OFF");
  const reason = `[WRITE_OFF] ${input.note.trim()}`;
  const now = new Date();

  const opId = randomUUID();

  await prisma.$transaction(async (tx) => {
    await tx.warehouseOperation.create({
      data: { id: opId, docNo, type: "WRITE_OFF", reason, createdById: user.id, createdAt: now }
    });
    await moveStock(tx, {
      palletTypeId: input.palletTypeId,
      condition: input.condition,
      delta: -input.quantity,
      fromDepartmentId: warehouse.id,
      warehouseOpId: opId,
      reason,
      occurredAt: now
    });
  });

  await writeAudit({
    userId: user.id,
    entity: "warehouse_operation",
    entityId: opId,
    action: "write_off",
    after: input
  });

  return { warehouseOpId: opId };
}

// ─── Warehouse summary ────────────────────────────────────────────────────────
// Returns every active palletType plus any inactive palletType that still has
// stock in the warehouse (so PM can clear leftover stock after deactivation).
export async function getWarehouseConditionSummary() {
  const [stocks, activePTs] = await Promise.all([
    prisma.warehouseStock.findMany({ include: { palletType: true } }),
    prisma.palletType.findMany({ where: { active: true }, orderBy: { name: "asc" } })
  ]);

  const byPt = new Map<
    string,
    { id: string; name: string; active: boolean; usable: number; inRepair: number; unusable: number }
  >();

  for (const pt of activePTs) {
    byPt.set(pt.id, { id: pt.id, name: pt.name, active: true, usable: 0, inRepair: 0, unusable: 0 });
  }

  for (const s of stocks) {
    let row = byPt.get(s.palletTypeId);
    if (!row) {
      row = {
        id: s.palletType.id,
        name: s.palletType.name,
        active: s.palletType.active,
        usable: 0,
        inRepair: 0,
        unusable: 0
      };
      byPt.set(s.palletTypeId, row);
    }
    if (s.condition === "GOOD") row.usable = s.quantity;
    else if (s.condition === "PENDING_REPAIR") row.inRepair = s.quantity;
    else if (s.condition === "DAMAGED") row.unusable = s.quantity;
  }

  return Array.from(byPt.values())
    .filter((r) => r.active || r.usable + r.inRepair + r.unusable > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
}
