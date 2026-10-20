import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { HttpError, requireRole } from "@/lib/auth/current-user";
import { fail, ok, readJson } from "@/lib/http/respond";
import { writeAudit } from "@/lib/services/audit";

const Create = z.object({
  departmentId: z.string().min(1),
  name: z.string().min(1).max(120),
});

// Public — no auth required so the registration page can show sections when a dept is selected.
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const departmentId = url.searchParams.get("departmentId") ?? undefined;
    const list = await prisma.departmentSection.findMany({
      where: { ...(departmentId ? { departmentId } : {}), active: true },
      orderBy: [{ departmentId: "asc" }, { name: "asc" }],
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

    const dup = await prisma.departmentSection.findFirst({
      where: { departmentId: data.departmentId, name: data.name },
    });
    if (dup) throw new HttpError(400, "มี section ชื่อนี้ในแผนกนี้แล้ว");

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
