import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { HttpError, requireRole } from "@/lib/auth/current-user";
import { fail, ok, readJson } from "@/lib/http/respond";
import { writeAudit } from "@/lib/services/audit";

// Note: `isWarehouse` is NOT patchable via UI. The warehouse flag is set in the
// seed and must stay invariant (exactly one warehouse dept always exists).
const Patch = z.object({
  name: z.string().min(1).max(120).optional(),
  active: z.boolean().optional(),
  requiresReturnSource: z.boolean().optional(),
});

export async function PATCH(req: Request, ctx: RouteContext<"/api/departments/[id]">) {
  try {
    const user = await requireRole("ADMIN");
    const { id } = await ctx.params;
    const data = Patch.parse(await readJson(req));

    const before = await prisma.department.findUnique({ where: { id } });
    if (!before) throw new HttpError(404, "ไม่พบแผนก");

    // Guard: cannot disable the warehouse department — breaks the whole system.
    if (data.active === false && before.isWarehouse) {
      throw new HttpError(400, "ไม่สามารถปิดใช้งานแผนกคลังพาเลทได้");
    }

    // Guard: name must stay unique.
    if (data.name && data.name !== before.name) {
      const dup = await prisma.department.findFirst({
        where: { name: data.name, id: { not: id } },
      });
      if (dup) throw new HttpError(400, "ชื่อแผนกนี้มีอยู่แล้ว");
    }

    const updated = await prisma.department.update({ where: { id }, data });
    await writeAudit({
      userId: user.id,
      entity: "department",
      entityId: id,
      action: "update",
      before,
      after: updated,
    });
    return ok(updated);
  } catch (e) {
    return fail(e);
  }
}
