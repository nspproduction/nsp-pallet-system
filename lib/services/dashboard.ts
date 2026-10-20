import { prisma } from "@/lib/prisma";

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface DashboardFilter {
  from?: Date;
  to?: Date;
  departmentId?: string;
  palletTypeId?: string;
}

export interface DashboardSummary {
  warehouseUsable: number;
  outstandingOutside: number;
  pendingRequests: number;
  approvedRequests: number;
  inRepair: number;
  writeOffLast30d: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dateWhere(filter?: DashboardFilter): { gte?: Date; lte?: Date } | undefined {
  if (!filter?.from && !filter?.to) return undefined;
  return {
    ...(filter.from ? { gte: filter.from } : {}),
    ...(filter.to ? { lte: filter.to } : {})
  };
}

// ─── Summary KPIs ─────────────────────────────────────────────────────────────

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const from30d = new Date();
  from30d.setDate(from30d.getDate() - 30);

  const [warehouseStocks, outstandingAgg, pending, approved, woAgg] = await Promise.all([
    // warehouseUsable + inRepair — O(1) snapshot read
    prisma.warehouseStock.findMany({
      where: { condition: { in: ["GOOD", "PENDING_REPAIR"] } }
    }),
    // outstandingOutside — sum of all non-warehouse dept snapshots
    prisma.departmentStock.aggregate({
      _sum: { quantity: true },
      where: { department: { isWarehouse: false } }
    }),
    prisma.request.count({ where: { status: { in: ["PENDING_DEPT", "PENDING_WAREHOUSE"] } } }),
    prisma.request.count({ where: { status: "COMPLETED" } }),
    prisma.stockMovement.aggregate({
      _sum: { quantity: true },
      where: { warehouseOp: { type: "WRITE_OFF" }, occurredAt: { gte: from30d } }
    })
  ]);

  const warehouseUsable = warehouseStocks.filter((r) => r.condition === "GOOD").reduce((s, r) => s + r.quantity, 0);
  const inRepair = warehouseStocks.filter((r) => r.condition === "PENDING_REPAIR").reduce((s, r) => s + r.quantity, 0);

  return {
    warehouseUsable,
    outstandingOutside: outstandingAgg._sum.quantity ?? 0,
    pendingRequests: pending,
    approvedRequests: approved,
    inRepair,
    writeOffLast30d: woAgg._sum?.quantity ?? 0
  };
}

// ─── Warehouse movement summary (SPEC §12: การเคลื่อนไหวของคลัง) ─────────────

export interface MovementRow {
  date: string; // YYYY-MM-DD
  issueOut: number;
  returnGood: number;
  returnRepair: number;
  returnDamaged: number;
  repairGood: number;
  repairDamaged: number;
  writeOff: number;
  adjustment: number;
}

export async function getWarehouseMovements(filter?: DashboardFilter): Promise<MovementRow[]> {
  const occurredAt = dateWhere(filter);
  const palletTypeId = filter?.palletTypeId;

  const movements = await prisma.stockMovement.findMany({
    where: {
      ...(occurredAt ? { occurredAt } : {}),
      ...(palletTypeId ? { palletTypeId } : {})
    },
    include: {
      warehouseOp: { select: { type: true } },
      request: { select: { type: true, condition: true } }
    },
    orderBy: { occurredAt: "asc" }
  });

  const byDate = new Map<string, MovementRow>();

  for (const m of movements) {
    const date = m.occurredAt.toISOString().slice(0, 10);
    if (!byDate.has(date)) {
      byDate.set(date, {
        date,
        issueOut: 0,
        returnGood: 0,
        returnRepair: 0,
        returnDamaged: 0,
        repairGood: 0,
        repairDamaged: 0,
        writeOff: 0,
        adjustment: 0
      });
    }
    const row = byDate.get(date)!;
    const opType = m.warehouseOp?.type ?? null;
    const reqType = m.request?.type ?? null;

    if (opType === "WRITE_OFF") row.writeOff += m.quantity;
    else if (opType === "ADJUSTMENT") row.adjustment += m.quantity;
    else if (opType === "REPAIR_RESULT") {
      if (m.condition === "GOOD") row.repairGood += m.quantity;
      else if (m.condition === "DAMAGED") row.repairDamaged += m.quantity;
    } else if (reqType === "ISSUE") row.issueOut += m.quantity;
    else if (reqType === "RETURN") {
      if (m.condition === "GOOD") row.returnGood += m.quantity;
      else if (m.condition === "PENDING_REPAIR") row.returnRepair += m.quantity;
      else if (m.condition === "DAMAGED") row.returnDamaged += m.quantity;
    }
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

// ─── Per-department stats (SPEC §12: รายแผนก) ────────────────────────────────

export interface DeptStatRow {
  departmentId: string;
  departmentName: string;
  issueQty: number;
  returnGoodQty: number;
  returnRepairQty: number;
  returnDamagedQty: number;
}

export async function getIssueReturnByDepartment(filter?: DashboardFilter): Promise<DeptStatRow[]> {
  const occurredAt = dateWhere(filter);
  const palletTypeId = filter?.palletTypeId;
  const deptWhere = filter?.departmentId ? { id: filter.departmentId } : undefined;

  const departments = await prisma.department.findMany({
    where: { active: true, ...(deptWhere ?? {}) },
    orderBy: { name: "asc" },
    select: { id: true, name: true }
  });
  const movements = await prisma.stockMovement.findMany({
    where: {
      request: { type: { in: ["ISSUE", "RETURN"] } },
      ...(occurredAt ? { occurredAt } : {}),
      ...(palletTypeId ? { palletTypeId } : {})
    },
    include: { request: { select: { type: true, condition: true } } }
  });

  const stats = new Map<string, Omit<DeptStatRow, "departmentName">>();
  for (const d of departments) {
    stats.set(d.id, {
      departmentId: d.id,
      issueQty: 0,
      returnGoodQty: 0,
      returnRepairQty: 0,
      returnDamagedQty: 0
    });
  }

  for (const m of movements) {
    const reqType = m.request?.type;
    if (!reqType) continue;

    if (reqType === "ISSUE" && m.toDepartmentId) {
      const s = stats.get(m.toDepartmentId);
      if (s) s.issueQty += m.quantity;
    } else if (reqType === "RETURN" && m.fromDepartmentId) {
      const s = stats.get(m.fromDepartmentId);
      if (s) {
        if (m.condition === "GOOD") s.returnGoodQty += m.quantity;
        else if (m.condition === "PENDING_REPAIR") s.returnRepairQty += m.quantity;
        else if (m.condition === "DAMAGED") s.returnDamagedQty += m.quantity;
      }
    }
  }

  return departments.map((d) => {
    const s = stats.get(d.id) ?? {
      departmentId: d.id,
      issueQty: 0,
      returnGoodQty: 0,
      returnRepairQty: 0,
      returnDamagedQty: 0
    };
    return {
      departmentId: d.id,
      departmentName: d.name,
      issueQty: s.issueQty,
      returnGoodQty: s.returnGoodQty,
      returnRepairQty: s.returnRepairQty,
      returnDamagedQty: s.returnDamagedQty
    };
  });
}

// ─── Per-person stats (SPEC §12: รายคน) ──────────────────────────────────────

export interface PersonStatRow {
  userId: string;
  fullName: string;
  departmentName: string;
  requestCount: number;
  issueQty: number;
  returnQty: number;
}

export async function getIssueReturnByPerson(filter?: DashboardFilter): Promise<PersonStatRow[]> {
  const createdAt = dateWhere(filter);

  const requests = await prisma.request.findMany({
    where: {
      status: "COMPLETED",
      type: { in: ["ISSUE", "RETURN"] },
      ...(createdAt ? { completedAt: createdAt } : {}),
      ...(filter?.departmentId ? { toDepartmentId: filter.departmentId } : {})
    },
    include: {
      requester: { select: { id: true, fullName: true } },
      fromDepartment: { select: { name: true } },
      toDepartment: { select: { name: true } },
      items: { select: { quantity: true } }
    }
  });

  const byPerson = new Map<string, PersonStatRow>();
  for (const r of requests) {
    const uid = r.requester.id;
    if (!byPerson.has(uid)) {
      byPerson.set(uid, {
        userId: uid,
        fullName: r.requester.fullName,
        departmentName: (r.type === "ISSUE" ? r.toDepartment?.name : r.fromDepartment?.name) ?? "-",
        requestCount: 0,
        issueQty: 0,
        returnQty: 0
      });
    }
    const p = byPerson.get(uid)!;
    p.requestCount++;
    const qty = r.items.reduce((s, it) => s + it.quantity, 0);
    if (r.type === "ISSUE") p.issueQty += qty;
    else p.returnQty += qty;
  }

  return Array.from(byPerson.values()).sort((a, b) => b.issueQty - a.issueQty);
}

// ─── Repair quality (SPEC §12: คุณภาพการซ่อม) ───────────────────────────────

export interface RepairQualityRow {
  palletTypeId: string;
  palletTypeName: string;
  totalRepaired: number; // sent in for repair (PENDING_REPAIR outflow from ops)
  repairedGood: number;
  repairedDamaged: number;
  repairRate: number; // repairedGood / totalRepaired
}

export async function getRepairQuality(filter?: DashboardFilter): Promise<RepairQualityRow[]> {
  const occurredAt = dateWhere(filter);

  const ops = await prisma.warehouseOperation.findMany({
    where: {
      type: "REPAIR_RESULT",
      ...(occurredAt ? { createdAt: occurredAt } : {})
    },
    include: {
      movements: {
        include: { palletType: { select: { id: true, name: true } } }
      }
    }
  });

  const byPT = new Map<string, RepairQualityRow>();
  for (const op of ops) {
    for (const m of op.movements) {
      const ptId = m.palletTypeId;
      if (!byPT.has(ptId)) {
        byPT.set(ptId, {
          palletTypeId: ptId,
          palletTypeName: m.palletType.name,
          totalRepaired: 0,
          repairedGood: 0,
          repairedDamaged: 0,
          repairRate: 0
        });
      }
      const row = byPT.get(ptId)!;
      if (m.condition === "PENDING_REPAIR") row.totalRepaired += m.quantity;
      else if (m.condition === "GOOD") row.repairedGood += m.quantity;
      else if (m.condition === "DAMAGED") row.repairedDamaged += m.quantity;
    }
  }

  return Array.from(byPT.values()).map((r) => ({
    ...r,
    repairRate: r.totalRepaired > 0 ? r.repairedGood / r.totalRepaired : 0
  }));
}


// ─── Trend chart data (SPEC §12: แนวโน้ว รายวัน/สัปดาห์/เดือน) ──────────────

export interface TrendPoint {
  label: string; // e.g. "2026-10-01" or "Oct W1"
  issued: number;
  returned: number;
}

export type TrendGranularity = "day" | "week" | "month";

// Default cap when the user hasn't set an explicit date filter — keeps the chart readable.
const TREND_DEFAULT_CAP: Record<TrendGranularity, number> = {
  day: 30, // last 30 days
  week: 26, // ~6 months
  month: 24 // ~2 years
};

export async function getTrend(granularity: TrendGranularity = "day", filter?: DashboardFilter): Promise<TrendPoint[]> {
  const hasExplicitDateFilter = !!filter?.from || !!filter?.to;
  const cap = TREND_DEFAULT_CAP[granularity];

  // When no date filter is set, limit the DB scan to the capped window.
  let effectiveFrom = filter?.from;
  if (!hasExplicitDateFilter) {
    const start = new Date();
    if (granularity === "day") start.setDate(start.getDate() - cap);
    else if (granularity === "week") start.setDate(start.getDate() - cap * 7);
    else start.setMonth(start.getMonth() - cap);
    effectiveFrom = start;
  }

  const occurredAt: { gte?: Date; lte?: Date } | undefined =
    effectiveFrom || filter?.to
      ? {
          ...(effectiveFrom ? { gte: effectiveFrom } : {}),
          ...(filter?.to ? { lte: filter.to } : {})
        }
      : undefined;

  const movements = await prisma.stockMovement.findMany({
    where: {
      ...(occurredAt ? { occurredAt } : {}),
      ...(filter?.palletTypeId ? { palletTypeId: filter.palletTypeId } : {})
    },
    include: {
      request: { select: { type: true } }
    },
    orderBy: { occurredAt: "asc" }
  });

  const byLabel = new Map<string, TrendPoint>();

  for (const m of movements) {
    const d = m.occurredAt;
    let label: string;
    if (granularity === "day") {
      label = d.toISOString().slice(0, 10);
    } else if (granularity === "week") {
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      label = weekStart.toISOString().slice(0, 10);
    } else {
      label = d.toISOString().slice(0, 7); // YYYY-MM
    }

    if (!byLabel.has(label)) byLabel.set(label, { label, issued: 0, returned: 0 });
    const p = byLabel.get(label)!;
    const reqType = m.request?.type;
    if (reqType === "ISSUE") p.issued += m.quantity;
    else if (reqType === "RETURN") p.returned += m.quantity;
  }

  const sorted = Array.from(byLabel.values()).sort((a, b) => a.label.localeCompare(b.label));
  // Safety trim: if partial periods near the boundary push beyond the cap, keep the latest N.
  return hasExplicitDateFilter ? sorted : sorted.slice(-cap);
}

