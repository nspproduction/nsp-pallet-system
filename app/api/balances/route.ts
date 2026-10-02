import { requireUser } from "@/lib/auth/current-user";
import { fail, ok } from "@/lib/http/respond";
import { prisma } from "@/lib/prisma";

// GET /api/balances?departmentId=xxx
// Returns stock balance aggregated by (palletType × condition × department).
// Default (no filter): all departments.
export async function GET(req: Request) {
  try {
    await requireUser();
    const url = new URL(req.url);
    const departmentId = url.searchParams.get("departmentId");

    const [ins, outs] = await Promise.all([
      prisma.stockMovement.groupBy({
        by: ["palletTypeId", "condition", "toDepartmentId"],
        _sum: { quantity: true },
        where: departmentId ? { toDepartmentId: departmentId } : {},
      }),
      prisma.stockMovement.groupBy({
        by: ["palletTypeId", "condition", "fromDepartmentId"],
        _sum: { quantity: true },
        where: departmentId ? { fromDepartmentId: departmentId } : {},
      }),
    ]);

    const bal = new Map<string, number>();
    const key = (p: string, c: string, d: string) => `${p}::${c}::${d}`;
    for (const r of ins) {
      if (!r.toDepartmentId) continue;
      const k = key(r.palletTypeId, r.condition, r.toDepartmentId);
      bal.set(k, (bal.get(k) ?? 0) + (r._sum.quantity ?? 0));
    }
    for (const r of outs) {
      if (!r.fromDepartmentId) continue;
      const k = key(r.palletTypeId, r.condition, r.fromDepartmentId);
      bal.set(k, (bal.get(k) ?? 0) - (r._sum.quantity ?? 0));
    }

    const rows = Array.from(bal.entries())
      .map(([k, quantity]) => {
        const [palletTypeId, condition, deptId] = k.split("::");
        return { palletTypeId, condition, departmentId: deptId, quantity };
      })
      .filter((r) => r.quantity !== 0);

    const [palletTypes, departments] = await Promise.all([
      prisma.palletType.findMany(),
      prisma.department.findMany(),
    ]);
    const ptMap = new Map(palletTypes.map((p) => [p.id, p]));
    const deptMap = new Map(departments.map((d) => [d.id, d]));

    return ok(
      rows.map((r) => ({
        ...r,
        palletType: ptMap.get(r.palletTypeId) ?? null,
        department: deptMap.get(r.departmentId) ?? null,
      })),
    );
  } catch (e) {
    return fail(e);
  }
}
