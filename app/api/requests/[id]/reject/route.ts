import { z } from "zod";
import { requireUser } from "@/lib/auth/current-user";
import { fail, ok, readJson } from "@/lib/http/respond";
import { rejectRequest } from "@/lib/services/request";
import { notifyRequesterOfDecision } from "@/lib/services/notification";

const Body = z.object({ comment: z.string().min(1).max(500) });

export async function POST(req: Request, ctx: RouteContext<"/api/requests/[id]/reject">) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = Body.parse(await readJson(req));
    const r = await rejectRequest(user, id, body.comment);
    notifyRequesterOfDecision(id, "REJECTED", body.comment).catch((e) => console.error("[notify]", e));
    return ok(r);
  } catch (e) {
    return fail(e);
  }
}
