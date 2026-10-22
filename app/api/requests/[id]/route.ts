import { requireUser } from "@/lib/auth/current-user";
import { fail, ok, readJson } from "@/lib/http/respond";
import { cancelRequest, getRequestDetail, getRequestWarnings } from "@/lib/services/request";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export async function GET(_: Request, ctx: RouteContext<"/api/requests/[id]">) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    const [r, warnings] = await Promise.all([getRequestDetail(id), getRequestWarnings(id)]);
    if (!r) return Response.json({ error: "not_found" }, { status: 404 });

    // Resolve approver fullNames referenced by stepSnapshot.approverIds so the
    // detail page can show "who can approve" on waiting/current steps without
    // an extra round-trip.
    const snapshot = Array.isArray(r.stepSnapshot)
      ? (r.stepSnapshot as Array<{ approverIds?: string[] }>)
      : [];
    const ids = [...new Set(snapshot.flatMap((s) => s.approverIds ?? []))];
    const users = ids.length
      ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, fullName: true } })
      : [];
    const approverNames: Record<string, string> = {};
    for (const u of users) approverNames[u.id] = u.fullName;

    return ok({ ...r, warnings, approverNames });
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
