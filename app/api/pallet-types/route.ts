import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, requireUser } from "@/lib/auth/current-user";
import { fail, ok, readJson } from "@/lib/http/respond";
import { writeAudit } from "@/lib/services/audit";

const Create = z.object({
  code: z.string().min(1).max(40),
  name: z.string().min(1).max(120),
  material: z.string().max(60).optional().nullable(),
  sizeSpec: z.string().max(60).optional().nullable(),
  minStock: z.coerce.number().int().min(0).default(0),
  active: z.boolean().default(true),
});

export async function GET() {
  try {
    await requireUser();
    const list = await prisma.palletType.findMany({ orderBy: { code: "asc" } });
    return ok(list);
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireRole("ADMIN");
    const data = Create.parse(await readJson(req));
    const created = await prisma.palletType.create({ data });
    await writeAudit({ userId: user.id, entity: "pallet_type", entityId: created.id, action: "create", after: created });
    return ok(created);
  } catch (e) {
    return fail(e);
  }
}
