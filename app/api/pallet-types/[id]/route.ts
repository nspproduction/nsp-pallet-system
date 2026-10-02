import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/current-user";
import { fail, ok, readJson } from "@/lib/http/respond";
import { writeAudit } from "@/lib/services/audit";

const Patch = z.object({
  code: z.string().min(1).max(40).optional(),
  name: z.string().min(1).max(120).optional(),
  material: z.string().max(60).optional().nullable(),
  sizeSpec: z.string().max(60).optional().nullable(),
  minStock: z.coerce.number().int().min(0).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(req: Request, ctx: RouteContext<"/api/pallet-types/[id]">) {
  try {
    const user = await requireRole("ADMIN");
    const { id } = await ctx.params;
    const data = Patch.parse(await readJson(req));
    const before = await prisma.palletType.findUnique({ where: { id } });
    const updated = await prisma.palletType.update({ where: { id }, data });
    await writeAudit({ userId: user.id, entity: "pallet_type", entityId: id, action: "update", before, after: updated });
    return ok(updated);
  } catch (e) {
    return fail(e);
  }
}
