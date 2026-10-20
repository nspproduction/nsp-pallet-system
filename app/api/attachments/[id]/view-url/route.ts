import { requireUser } from "@/lib/auth/current-user";
import { fail } from "@/lib/http/respond";
import { getAttachmentViewUrl } from "@/lib/services/attachment";

export async function GET(_: Request, ctx: RouteContext<"/api/attachments/[id]/view-url">) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    const url = await getAttachmentViewUrl(id);
    if (!url) return Response.json({ error: "not_found" }, { status: 404 });
    return Response.json({ url });
  } catch (e) {
    return fail(e);
  }
}
