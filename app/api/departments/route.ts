import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { HttpError, requireRole } from "@/lib/auth/current-user";
import { fail, ok, readJson } from "@/lib/http/respond";
import { writeAudit } from "@/lib/services/audit";

const Create = z.object({
  name: z.string().min(1).max(120),
});

// Public — no auth required so the registration page can populate the dropdown.
export async function GET() {
  try {
    return ok(await prisma.department.findMany({ where: { active: true, isWarehouse: false }, orderBy: { name: "asc" } }));
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireRole("ADMIN");
    const data = Create.parse(await readJson(req));

    const existing = await prisma.department.findFirst({ where: { name: data.name } });
    if (existing) throw new HttpError(400, "ชื่อแผนกนี้มีอยู่แล้ว");

    const created = await prisma.department.create({ data });
    await writeAudit({ userId: user.id, entity: "department", entityId: created.id, action: "create", after: created });
    return ok(created);
  } catch (e) {
    return fail(e);
  }
}
