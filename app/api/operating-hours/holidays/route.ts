import { z } from "zod";
import { requireRole, requireUser } from "@/lib/auth/current-user";
import { fail, ok, readJson } from "@/lib/http/respond";
import { listHolidays, createHoliday } from "@/lib/services/operating-hours";

const Body = z.object({
  date: z.coerce.date(),
  name: z.string().trim().min(1).max(120),
});

export async function GET() {
  try {
    // GET stays open to any logged-in user — admin UI uses this, and the
    // list is shown as hints elsewhere.
    await requireUser();
    return ok(await listHolidays());
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireRole("ADMIN");
    const data = Body.parse(await readJson(req));
    const created = await createHoliday(user, data.date, data.name);
    return ok(created);
  } catch (e) {
    return fail(e);
  }
}
