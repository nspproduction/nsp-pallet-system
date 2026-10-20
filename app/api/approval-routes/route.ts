import { z } from "zod";
import { requireUser } from "@/lib/auth/current-user";
import { fail, ok, readJson } from "@/lib/http/respond";
import { listRoutes, upsertRoute } from "@/lib/services/approval-route";

const StepSchema = z.object({
  stepOrder: z.coerce.number().int().positive(),
  name: z.string().min(1).max(80),
  approverIds: z.array(z.string()).min(1),
});

const Body = z.object({
  departmentId: z.string().min(1),
  requestType: z.enum(["ISSUE", "RETURN"]),
  steps: z.array(StepSchema).min(1),
});

export async function GET() {
  try {
    await requireUser();
    return ok(await listRoutes());
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const data = Body.parse(await readJson(req));
    const route = await upsertRoute(user, data);
    return ok(route);
  } catch (e) {
    return fail(e);
  }
}
