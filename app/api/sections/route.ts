import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, getSessionUserAnyStatus, HttpError } from "@/lib/auth/current-user";
import { fail, ok, readJson } from "@/lib/http/respond";
import { writeAudit } from "@/lib/services/audit";

const Create = z.object({
  departmentId: z.string().min(1),
  code: z.string().min(1).max(40),
  name: z.string().min(1).max(120),
});

// Readable by any authenticated session (including PENDING users) so the
// registration page can populate section options when a dept is selected.
export async function GET(req: Request) {
  try {
    const u = await getSessionUserAnyStatus();
    if (!u) throw new HttpError(401, "unauthenticated");
    const url = new URL(req.url);
    const departmentId = url.searchParams.get("departmentId") ?? undefined;
    const list = await prisma.departmentSection.findMany({
      where: departmentId ? { departmentId } : {},
      orderBy: [{ departmentId: "asc" }, { code: "asc" }],
    });
    return ok(list);
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireRole("ADMIN");
    const data = Create.parse(await readJson(req));
    const created = await prisma.departmentSection.create({ data });
    await writeAudit({
      userId: admin.id,
      entity: "department_section",
      entityId: created.id,
      action: "create",
      after: created,
    });
    return ok(created);
  } catch (e) {
    return fail(e);
  }
}
