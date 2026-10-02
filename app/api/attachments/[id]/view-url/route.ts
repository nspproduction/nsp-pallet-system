import { requireUser } from "@/lib/auth/current-user";
import { fail, ok } from "@/lib/http/respond";
import { prisma } from "@/lib/prisma";
import { getViewUrl } from "@/lib/services/attachment";

export async function GET(_: Request, ctx: RouteContext<"/api/attachments/[id]/view-url">) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    const a = await prisma.attachment.findUnique({ where: { id } });
    if (!a) return Response.json({ error: "not_found" }, { status: 404 });
    return ok({ url: await getViewUrl(a.filePath) });
  } catch (e) {
    return fail(e);
  }
}
