import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { HttpError, requireRole } from "@/lib/auth/current-user";
import { fail, ok, readJson } from "@/lib/http/respond";
import { writeAudit } from "@/lib/services/audit";

const Patch = z.object({
  name: z.string().min(1).max(120).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(req: Request, ctx: RouteContext<"/api/sections/[id]">) {
  try {
    const admin = await requireRole("ADMIN");
    const { id } = await ctx.params;
    const data = Patch.parse(await readJson(req));

    const before = await prisma.departmentSection.findUnique({ where: { id } });
    if (!before) throw new HttpError(404, "ไม่พบ section");

    // Guard: section name must stay unique within its department.
    if (data.name && data.name !== before.name) {
      const dup = await prisma.departmentSection.findFirst({
        where: { departmentId: before.departmentId, name: data.name, id: { not: id } },
      });
      if (dup) throw new HttpError(400, "มี section ชื่อนี้ในแผนกนี้แล้ว");
    }

    const updated = await prisma.departmentSection.update({ where: { id }, data });
    await writeAudit({
      userId: admin.id,
      entity: "department_section",
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
