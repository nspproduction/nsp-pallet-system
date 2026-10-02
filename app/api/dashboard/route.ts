import { requireUser } from "@/lib/auth/current-user";
import { fail, ok } from "@/lib/http/respond";
import { getDashboardSummary } from "@/lib/services/dashboard";

export async function GET() {
  try {
    await requireUser();
    return ok(await getDashboardSummary());
  } catch (e) {
    return fail(e);
  }
}
