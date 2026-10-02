import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, HttpError } from "@/lib/auth/current-user";
import { fail, ok, readJson } from "@/lib/http/respond";
import { writeAudit } from "@/lib/services/audit";

const Patch = z.object({
  fullName: z.string().min(1).max(120).optional(),
  employeeCode: z.string().min(1).max(40).optional(),
  phone: z.string().max(40).optional().nullable(),
  role: z.enum(["REQUESTER", "APPROVER", "STORE", "ADMIN", "VIEWER"]).optional(),
  status: z.enum(["PENDING", "ACTIVE", "DISABLED"]).optional(),
  departmentId: z.string().optional().nullable(),
  sectionId: z.string().optional().nullable(),
});

export async function PATCH(req: Request, ctx: RouteContext<"/api/users/[id]">) {
  try {
    const admin = await requireRole("ADMIN");
    const { id } = await ctx.params;
    const data = Patch.parse(await readJson(req));
    const before = await prisma.user.findUnique({ where: { id } });
    if (!before) throw new HttpError(404, "ไม่พบผู้ใช้");

    // Validate section belongs to the resulting department
    const resolvedDeptId =
      data.departmentId === undefined ? before.departmentId : data.departmentId;
    if (data.sectionId) {
      const section = await prisma.departmentSection.findUnique({
        where: { id: data.sectionId },
      });
      if (!section) throw new HttpError(400, "ไม่พบ section");
      if (section.departmentId !== resolvedDeptId) {
        throw new HttpError(400, "section ไม่อยู่ในแผนกที่กำหนด");
      }
    }
    // If dept changed and section not explicitly set, clear section to avoid orphan
    if (data.departmentId !== undefined && data.sectionId === undefined) {
      data.sectionId = null;
    }

    const updated = await prisma.user.update({ where: { id }, data });
    await writeAudit({
      userId: admin.id,
      entity: "user",
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
