import { z } from "zod";
import { requireUser } from "@/lib/auth/current-user";
import { fail, ok, readJson } from "@/lib/http/respond";
import { writeOffPallets } from "@/lib/services/warehouse";

const Body = z.object({
  palletTypeId: z.string(),
  condition: z.enum(["USABLE", "IN_REPAIR", "UNUSABLE"]).default("UNUSABLE"),
  quantity: z.coerce.number().int().positive(),
  note: z.string().min(1).max(500),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = Body.parse(await readJson(req));
    return ok(await writeOffPallets(user, body));
  } catch (e) {
    return fail(e);
  }
}
