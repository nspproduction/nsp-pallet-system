import { z } from "zod";
import { requireRole } from "@/lib/auth/current-user";
import { fail, ok, readJson } from "@/lib/http/respond";
import { adjustStock } from "@/lib/services/request";

const Body = z.object({
  palletTypeId: z.string(),
  condition: z.enum(["GOOD", "PENDING_REPAIR", "DAMAGED"]),
  fromDepartmentId: z.string().optional().nullable(),
  toDepartmentId: z.string().optional().nullable(),
  quantity: z.coerce.number().int().positive(),
  reason: z.string().trim().min(1).max(500),
});

export async function POST(req: Request) {
  try {
    const user = await requireRole("ADMIN");
    const body = Body.parse(await readJson(req));
    return ok(await adjustStock(user, body));
  } catch (e) {
    return fail(e);
  }
}
