import { requireUser } from "@/lib/auth/current-user";
import { fail, ok } from "@/lib/http/respond";
import { deleteRoute } from "@/lib/services/approval-route";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await deleteRoute(user, id);
    return ok({ deleted: true });
  } catch (e) {
    return fail(e);
  }
}
