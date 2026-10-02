import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, getSessionUserAnyStatus, HttpError } from "@/lib/auth/current-user";
import { fail, ok, readJson } from "@/lib/http/respond";
import { writeAudit } from "@/lib/services/audit";

const Create = z.object({
  code: z.string().min(1).max(40),
  name: z.string().min(1).max(120),
});

// Readable by any authenticated session (including PENDING users) so the
// registration page can populate the department dropdown.
export async function GET() {
  try {
    const u = await getSessionUserAnyStatus();
    if (!u) throw new HttpError(401, "unauthenticated");
    return ok(await prisma.department.findMany({ orderBy: { code: "asc" } }));
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireRole("ADMIN");
    const data = Create.parse(await readJson(req));
    const created = await prisma.department.create({ data });
    await writeAudit({ userId: user.id, entity: "department", entityId: created.id, action: "create", after: created });
    return ok(created);
  } catch (e) {
    return fail(e);
  }
}
