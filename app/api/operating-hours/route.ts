import { z } from "zod";
import { requireRole, requireUser } from "@/lib/auth/current-user";
import { fail, ok, readJson } from "@/lib/http/respond";
import { listOperatingHours, createOperatingHours, checkOperatingHours } from "@/lib/services/operating-hours";

const Body = z.object({
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  label: z.string().max(80).optional().nullable(),
});

export async function GET(req: Request) {
  try {
    // GET is used by both the admin UI (list) and the requester's new-request
    // page (?check=1 for the open/closed banner), so we only require login here.
    await requireUser();
    const url = new URL(req.url);
    if (url.searchParams.get("check") === "1") {
      return ok(await checkOperatingHours());
    }
    return ok(await listOperatingHours());
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireRole("ADMIN");
    const data = Body.parse(await readJson(req));
    const created = await createOperatingHours(user, data);
    return ok(created);
  } catch (e) {
    return fail(e);
  }
}
