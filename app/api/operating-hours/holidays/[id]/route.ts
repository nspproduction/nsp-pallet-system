import { requireRole } from "@/lib/auth/current-user";
import { fail, ok } from "@/lib/http/respond";
import { deleteHoliday } from "@/lib/services/operating-hours";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole("ADMIN");
    const { id } = await params;
    await deleteHoliday(user, id);
    return ok({ deleted: true });
  } catch (e) {
    return fail(e);
  }
}
