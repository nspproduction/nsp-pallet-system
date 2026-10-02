import { requireUser } from "@/lib/auth/current-user";
import { fail, ok } from "@/lib/http/respond";
import { getWarehouseConditionSummary } from "@/lib/services/warehouse";

export async function GET() {
  try {
    await requireUser();
    return ok(await getWarehouseConditionSummary());
  } catch (e) {
    return fail(e);
  }
}
