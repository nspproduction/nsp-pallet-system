import { z } from "zod";
import { requireUser } from "@/lib/auth/current-user";
import { fail, ok, readJson } from "@/lib/http/respond";
import { approveRequest } from "@/lib/services/request";
import { notifyRequestCompleted, notifyApproversOfNewRequest } from "@/lib/services/notification";

const Body = z.object({ comment: z.string().max(500).optional() });

export async function POST(req: Request, ctx: RouteContext<"/api/requests/[id]/approve">) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = Body.parse(await readJson(req).catch(() => ({})));
    const r = await approveRequest(user, id, body.comment);
    if (r.status === "COMPLETED") {
      notifyRequestCompleted(id).catch((e: unknown) => console.error("[notify]", e));
    } else {
      notifyApproversOfNewRequest(id).catch((e: unknown) => console.error("[notify]", e));
    }
    return ok(r);
  } catch (e) {
    return fail(e);
  }
}
