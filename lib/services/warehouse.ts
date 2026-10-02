import { randomUUID } from "node:crypto";
import type { PalletCondition } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/auth/current-user";
import type { SessionUser } from "@/lib/auth/current-user";
import { writeAudit } from "@/lib/services/audit";

const WAREHOUSE_DEPT_CODE = "WH-PL";

async function getWarehouse() {
  const d = await prisma.department.findUnique({ where: { code: WAREHOUSE_DEPT_CODE } });
  if (!d || !d.active) throw new HttpError(500, `ยังไม่ได้ตั้งค่าแผนกคลังพาเลท (${WAREHOUSE_DEPT_CODE})`);
  return d;
}

function requireApprover(user: SessionUser) {
  if (!["APPROVER", "ADMIN"].includes(user.role)) {
    throw new HttpError(403, "เฉพาะผู้อนุมัติเท่านั้น");
  }
}

async function getPhysicalBalance(
  departmentId: string,
  palletTypeId: string,
  condition: PalletCondition,
): Promise<number> {
  const [ins, outs] = await Promise.all([
    prisma.stockMovement.aggregate({
      _sum: { quantity: true },
      where: { toDepartmentId: departmentId, palletTypeId, condition },
    }),
    prisma.stockMovement.aggregate({
      _sum: { quantity: true },
      where: { fromDepartmentId: departmentId, palletTypeId, condition },
    }),
  ]);
  return (ins._sum.quantity ?? 0) - (outs._sum.quantity ?? 0);
}

// Repair: convert IN_REPAIR pallets into USABLE at the warehouse (in-place).
// Modelled as a pair of movements sharing movementGroupId:
//   - OUT: condition=IN_REPAIR, from=warehouse → removes from IN_REPAIR bucket
//   - IN : condition=USABLE,   to=warehouse  → adds to USABLE bucket
export async function repairPallets(
  user: SessionUser,
  input: { palletTypeId: string; quantity: number; note?: string },
) {
  requireApprover(user);
  if (input.quantity <= 0) throw new HttpError(400, "quantity ต้อง > 0");
  const warehouse = await getWarehouse();
  const avail = await getPhysicalBalance(warehouse.id, input.palletTypeId, "IN_REPAIR");
  if (avail < input.quantity) {
    throw new HttpError(400, `ยอดรอซ่อมไม่พอ (มี ${avail}, ขอ ${input.quantity})`);
  }

  const groupId = randomUUID();
  const reason = `[REPAIR]${input.note ? ` ${input.note}` : ""}`;
  const now = new Date();

  const [outMovement, inMovement] = await prisma.$transaction([
    prisma.stockMovement.create({
      data: {
        movementGroupId: groupId,
        palletTypeId: input.palletTypeId,
        condition: "IN_REPAIR",
        quantity: input.quantity,
        fromDepartmentId: warehouse.id,
        reason,
        occurredAt: now,
      },
    }),
    prisma.stockMovement.create({
      data: {
        movementGroupId: groupId,
        palletTypeId: input.palletTypeId,
        condition: "USABLE",
        quantity: input.quantity,
        toDepartmentId: warehouse.id,
        reason,
        occurredAt: now,
      },
    }),
  ]);

  await writeAudit({
    userId: user.id,
    entity: "stock_movement",
    entityId: groupId,
    action: "repair",
    after: { ...input, movementGroupId: groupId },
  });

  return { movementGroupId: groupId, out: outMovement, in: inMovement };
}

// Write off: remove pallets from the warehouse without a destination.
// Default condition is UNUSABLE but any is allowed (approver's judgement).
export async function writeOffPallets(
  user: SessionUser,
  input: {
    palletTypeId: string;
    condition: PalletCondition;
    quantity: number;
    note?: string;
  },
) {
  requireApprover(user);
  if (input.quantity <= 0) throw new HttpError(400, "quantity ต้อง > 0");
  if (!input.note?.trim()) throw new HttpError(400, "ต้องระบุเหตุผลการตัดจำหน่าย");
  const warehouse = await getWarehouse();
  const avail = await getPhysicalBalance(warehouse.id, input.palletTypeId, input.condition);
  if (avail < input.quantity) {
    throw new HttpError(400, `ยอด ${input.condition} คงเหลือไม่พอ (มี ${avail}, ขอ ${input.quantity})`);
  }

  const movement = await prisma.stockMovement.create({
    data: {
      palletTypeId: input.palletTypeId,
      condition: input.condition,
      quantity: input.quantity,
      fromDepartmentId: warehouse.id,
      reason: `[WRITE_OFF] ${input.note.trim()}`,
    },
  });

  await writeAudit({
    userId: user.id,
    entity: "stock_movement",
    entityId: movement.id,
    action: "write_off",
    after: input,
  });

  return movement;
}

export async function getWarehouseConditionSummary() {
  const warehouse = await getWarehouse();
  const [ins, outs, palletTypes] = await Promise.all([
    prisma.stockMovement.groupBy({
      by: ["palletTypeId", "condition"],
      _sum: { quantity: true },
      where: { toDepartmentId: warehouse.id },
    }),
    prisma.stockMovement.groupBy({
      by: ["palletTypeId", "condition"],
      _sum: { quantity: true },
      where: { fromDepartmentId: warehouse.id },
    }),
    prisma.palletType.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
  ]);

  const bal = new Map<string, number>();
  const k = (pt: string, c: string) => `${pt}::${c}`;
  for (const r of ins) bal.set(k(r.palletTypeId, r.condition), r._sum.quantity ?? 0);
  for (const r of outs) {
    const key = k(r.palletTypeId, r.condition);
    bal.set(key, (bal.get(key) ?? 0) - (r._sum.quantity ?? 0));
  }

  return palletTypes.map((pt) => ({
    id: pt.id,
    code: pt.code,
    name: pt.name,
    usable: bal.get(k(pt.id, "USABLE")) ?? 0,
    inRepair: bal.get(k(pt.id, "IN_REPAIR")) ?? 0,
    unusable: bal.get(k(pt.id, "UNUSABLE")) ?? 0,
  }));
}
