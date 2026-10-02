import { requireUser } from "@/lib/auth/current-user";
import { fail, ok, readJson } from "@/lib/http/respond";
import { cancelRequest, getRequestDetail } from "@/lib/services/request";
import { z } from "zod";

export async function GET(_: Request, ctx: RouteContext<"/api/requests/[id]">) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    const r = await getRequestDetail(id);
    if (!r) return Response.json({ error: "not_found" }, { status: 404 });
    return ok(r);
  } catch (e) {
    return fail(e);
  }
}

const CancelBody = z.object({ reason: z.string().max(300).optional() }).optional();

export async function DELETE(req: Request, ctx: RouteContext<"/api/requests/[id]">) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    let reason: string | undefined;
    try {
      const body = CancelBody.parse(await readJson(req));
      reason = body?.reason;
    } catch {
      /* body optional */
    }
    return ok(await cancelRequest(user, id, reason));
  } catch (e) {
    return fail(e);
  }
}
