import { z } from "zod";
import { requireUser } from "@/lib/auth/current-user";
import { fail, ok, readJson } from "@/lib/http/respond";
import { updateOperatingHours, deleteOperatingHours } from "@/lib/services/operating-hours";

const Patch = z.object({
  dayOfWeek: z.coerce.number().int().min(0).max(6).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  label: z.string().max(80).optional().nullable(),
}).partial();

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const data = Patch.parse(await readJson(req));
    const updated = await updateOperatingHours(user, id, data);
    return ok(updated);
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await deleteOperatingHours(user, id);
    return ok({ deleted: true });
  } catch (e) {
    return fail(e);
  }
}
