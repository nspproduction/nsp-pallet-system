import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { HttpError, requireRole } from "@/lib/auth/current-user";
import { fail, ok, readJson } from "@/lib/http/respond";
import { writeAudit } from "@/lib/services/audit";

const Patch = z.object({
  name: z.string().min(1).max(120).optional(),
  sizeSpec: z.string().max(60).optional().nullable(),
  active: z.boolean().optional(),
});

export async function PATCH(req: Request, ctx: RouteContext<"/api/pallet-types/[id]">) {
  try {
    const user = await requireRole("ADMIN");
    const { id } = await ctx.params;
    const data = Patch.parse(await readJson(req));
    const before = await prisma.palletType.findUnique({ where: { id } });
    try {
      const updated = await prisma.palletType.update({ where: { id }, data });
      await writeAudit({ userId: user.id, entity: "pallet_type", entityId: id, action: "update", before, after: updated });
      return ok(updated);
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
