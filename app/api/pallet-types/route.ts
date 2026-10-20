import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { HttpError, requireRole, requireUser } from "@/lib/auth/current-user";
import { fail, ok, readJson } from "@/lib/http/respond";
import { writeAudit } from "@/lib/services/audit";

const Create = z.object({
  name: z.string().min(1).max(120),
  sizeSpec: z.string().max(60).optional().nullable(),
  active: z.boolean().default(true),
});

export async function GET() {
  try {
    await requireUser();
    const list = await prisma.palletType.findMany({ where: { active: true }, orderBy: { name: "asc" } });
    return ok(list);
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireRole("ADMIN");
    const data = Create.parse(await readJson(req));
    try {
      const created = await prisma.palletType.create({ data });
      await writeAudit({ userId: user.id, entity: "pallet_type", entityId: created.id, action: "create", after: created });
      return ok(created);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new HttpError(400, "ชื่อประเภทพาเลทนี้มีอยู่แล้ว");
      }
      throw e;
    }
  } catch (e) {
    return fail(e);
  }
}
