import { requireUser } from "@/lib/auth/current-user";
import { fail, ok } from "@/lib/http/respond";
import { deleteAttachment } from "@/lib/services/attachment";
import { writeAudit } from "@/lib/services/audit";

export async function DELETE(_: Request, ctx: RouteContext<"/api/attachments/[id]">) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    await deleteAttachment(id);
    await writeAudit({ userId: user.id, entity: "attachment", entityId: id, action: "delete" });
    return ok({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
