import { HttpError, requireUser } from "@/lib/auth/current-user";
import { fail, ok } from "@/lib/http/respond";
import { getWarehouseConditionSummary } from "@/lib/services/warehouse";

export async function GET() {
  try {
    const user = await requireUser();
    if (!user.roles.some((r) => ["PALLET_MANAGER", "ADMIN"].includes(r))) {
      throw new HttpError(403, "เฉพาะ Pallet Manager หรือ Admin เท่านั้น");
    }
    return ok(await getWarehouseConditionSummary());
  } catch (e) {
    return fail(e);
  }
}
