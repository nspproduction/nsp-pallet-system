import { z } from "zod";
import { requireUser } from "@/lib/auth/current-user";
import { fail, ok, readJson } from "@/lib/http/respond";
import { repairPallets } from "@/lib/services/warehouse";

const Body = z.object({
  palletTypeId: z.string(),
  quantity: z.coerce.number().int().positive(),
  note: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = Body.parse(await readJson(req));
    return ok(await repairPallets(user, body));
  } catch (e) {
    return fail(e);
  }
}
