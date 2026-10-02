import { z } from "zod";
import { requireUser } from "@/lib/auth/current-user";
import { fail, ok, readJson } from "@/lib/http/respond";
import { fulfillRequest } from "@/lib/services/request";
import { notifyRequesterOfFulfillment } from "@/lib/services/notification";

const Body = z.object({
  actuals: z.array(z.object({
    requestItemId: z.string(),
    actualQuantity: z.coerce.number().int().min(0),
  })).default([]),
  comment: z.string().max(500).optional(),
});

export async function POST(req: Request, ctx: RouteContext<"/api/requests/[id]/fulfill">) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = Body.parse(await readJson(req).catch(() => ({})));
    const r = await fulfillRequest(user, id, body.actuals, body.comment);
    notifyRequesterOfFulfillment(id).catch((e) => console.error("[notify]", e));
    return ok(r);
  } catch (e) {
    return fail(e);
  }
}
