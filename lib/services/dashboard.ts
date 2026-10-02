import { prisma } from "@/lib/prisma";
import { WAREHOUSE_DEPT_CODE } from "@/lib/services/request";

export interface DashboardSummary {
  warehouseUsable: number;
  outstandingOutside: number;
  pendingRequests: number;
  approvedAwaitingFulfill: number;
  inRepair: number;
  writeOffLast30d: number;
  pendingByType: { type: string; count: number }[];
}

async function sumMovement(where: Record<string, unknown>): Promise<number> {
  const r = await prisma.stockMovement.aggregate({ _sum: { quantity: true }, where });
  return r._sum.quantity ?? 0;
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const warehouse = await prisma.department.findUnique({
    where: { code: WAREHOUSE_DEPT_CODE },
    select: { id: true },
  });
  const warehouseId = warehouse?.id ?? null;

  // On-hand at warehouse (USABLE only)
  let warehouseUsable = 0;
  if (warehouseId) {
    const [inUsable, outUsable] = await Promise.all([
      sumMovement({ condition: "USABLE", toDepartmentId: warehouseId }),
      sumMovement({ condition: "USABLE", fromDepartmentId: warehouseId }),
    ]);
    warehouseUsable = inUsable - outUsable;
  }

  // In repair = USABLE pallets flagged IN_REPAIR, physically still in warehouse
  let inRepair = 0;
  if (warehouseId) {
    const [inRep, outRep] = await Promise.all([
      sumMovement({ condition: "IN_REPAIR", toDepartmentId: warehouseId }),
      sumMovement({ condition: "IN_REPAIR", fromDepartmentId: warehouseId }),
    ]);
    inRepair = inRep - outRep;
  }

  // Outstanding outside warehouse (sum of all pallets with toDepartment !== warehouse
  // and still not returned). Phase-1 binary model: approximate via net inflow to any
  // non-warehouse department.
  const [outIn, outOut] = await Promise.all([
    sumMovement({ toDepartmentId: warehouseId ? { not: warehouseId } : { not: null } }),
    sumMovement({ fromDepartmentId: warehouseId ? { not: warehouseId } : { not: null } }),
  ]);
  const outstandingOutside = outIn - outOut;

  // Requests counts
  const [pending, approved] = await Promise.all([
    prisma.request.count({ where: { status: "PENDING" } }),
    prisma.request.count({ where: { status: "APPROVED" } }),
  ]);

  // Write-off in last 30 days (requests of type WRITE_OFF, fulfilled)
  const from = new Date();
  from.setDate(from.getDate() - 30);
  const woAgg = await prisma.stockMovement.aggregate({
    _sum: { quantity: true },
    where: {
      request: { type: "WRITE_OFF" },
      occurredAt: { gte: from },
    },
  });
  const writeOffLast30d = woAgg._sum.quantity ?? 0;

  // Pending by type
  const pendingByTypeRaw = await prisma.request.groupBy({
    by: ["type"],
    where: { status: "PENDING" },
    _count: { _all: true },
  });
  const pendingByType = pendingByTypeRaw
    .map((r) => ({ type: r.type as string, count: r._count._all }))
    .sort((a, b) => b.count - a.count);

  return {
    warehouseUsable,
    outstandingOutside,
    pendingRequests: pending,
    approvedAwaitingFulfill: approved,
    inRepair,
    writeOffLast30d,
    pendingByType,
  };
}

// Outstanding by department (replacement for the removed per-location breakdown)
export async function getOutstandingByDepartment() {
  const warehouse = await prisma.department.findUnique({
    where: { code: WAREHOUSE_DEPT_CODE },
    select: { id: true },
  });

  const departments = await prisma.department.findMany({
    where: { active: true, id: warehouse?.id ? { not: warehouse.id } : undefined },
    orderBy: { code: "asc" },
  });

  const results = await Promise.all(
    departments.map(async (dept) => {
      const [ins, outs] = await Promise.all([
        prisma.stockMovement.groupBy({
          by: ["palletTypeId", "condition"],
          _sum: { quantity: true },
          where: { toDepartmentId: dept.id },
        }),
        prisma.stockMovement.groupBy({
          by: ["palletTypeId", "condition"],
          _sum: { quantity: true },
          where: { fromDepartmentId: dept.id },
        }),
      ]);
      const bal = new Map<string, number>();
      for (const r of ins) bal.set(`${r.palletTypeId}::${r.condition}`, r._sum.quantity ?? 0);
      for (const r of outs) {
        const k = `${r.palletTypeId}::${r.condition}`;
        bal.set(k, (bal.get(k) ?? 0) - (r._sum.quantity ?? 0));
      }
      const rows = Array.from(bal.entries())
        .map(([k, qty]) => {
          const [palletTypeId, condition] = k.split("::");
          return { palletTypeId, condition, quantity: qty };
        })
        .filter((r) => r.quantity !== 0);
      const total = rows.reduce((s, r) => s + r.quantity, 0);
      return { department: dept, rows, total };
    }),
  );

  return results;
}
