import { requireUser } from "@/lib/auth/current-user";
import { fail, ok } from "@/lib/http/respond";
import { prisma } from "@/lib/prisma";

// GET /api/balances?departmentId=xxx&deductPending=1
// Returns stock balance per (palletType × condition × department).
// Warehouse rows are sourced from `warehouseStock` (authoritative per CLAUDE.md Rule 1).
// Non-warehouse dept rows are sourced from `departmentStock` filtered to isWarehouse=false.
export async function GET(req: Request) {
  try {
    await requireUser();
    const url = new URL(req.url);
    const departmentId = url.searchParams.get("departmentId");
    const deductPending = url.searchParams.get("deductPending") === "1";

    const warehouseDepts = await prisma.department.findMany({
      where: { isWarehouse: true },
      select: { id: true, name: true, isWarehouse: true }
    });
    const warehouseIds = new Set(warehouseDepts.map((d) => d.id));
    const primaryWarehouse = warehouseDepts[0] ?? null;

    const includeWarehouse = !!primaryWarehouse && (!departmentId || warehouseIds.has(departmentId));
    const includeDepts = !departmentId || !warehouseIds.has(departmentId);

    const [warehouseStocks, deptStocks] = await Promise.all([
      includeWarehouse ? prisma.warehouseStock.findMany({ include: { palletType: true } }) : Promise.resolve([]),
      includeDepts
        ? prisma.departmentStock.findMany({
            where: {
              department: { isWarehouse: false },
              ...(departmentId ? { departmentId } : {})
            },
            include: { palletType: true, department: true }
          })
        : Promise.resolve([])
    ]);

    type Row = {
      palletTypeId: string;
      condition: string;
      departmentId: string;
      quantity: number;
      palletType: { id: string; name: string } | null;
      department: { id: string; name: string; isWarehouse: boolean } | null;
    };
    const bal = new Map<string, Row>();
    const key = (p: string, c: string, d: string) => `${p}::${c}::${d}`;

    if (primaryWarehouse) {
      for (const s of warehouseStocks) {
        bal.set(key(s.palletTypeId, s.condition, primaryWarehouse.id), {
          palletTypeId: s.palletTypeId,
          condition: s.condition,
          departmentId: primaryWarehouse.id,
          quantity: s.quantity,
          palletType: s.palletType,
          department: primaryWarehouse
        });
      }
    }

    for (const r of deptStocks) {
      bal.set(key(r.palletTypeId, r.condition, r.departmentId), {
        palletTypeId: r.palletTypeId,
        condition: r.condition,
        departmentId: r.departmentId,
        quantity: r.quantity,
        palletType: r.palletType,
        department: r.department
      });
    }

    if (deductPending) {
      const pendingItems = await prisma.requestItem.findMany({
        where: {
          request: {
            type: { in: ["ISSUE", "RETURN"] },
            status: { in: ["PENDING_DEPT", "PENDING_WAREHOUSE"] },
            ...(departmentId ? { fromDepartmentId: departmentId } : {})
          }
        },
        select: {
          palletTypeId: true,
          quantity: true,
          request: { select: { fromDepartmentId: true, condition: true } }
        }
      });
      for (const item of pendingItems) {
        const deptId = item.request.fromDepartmentId;
        const condition = item.request.condition ?? "GOOD";
        if (!deptId) continue;
        const row = bal.get(key(item.palletTypeId, condition, deptId));
        if (row) row.quantity -= item.quantity;
      }
    }

    return ok(Array.from(bal.values()).filter((r) => r.quantity !== 0));
  } catch (e) {
    return fail(e);
  }
}
