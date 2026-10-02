import { requireUser } from "@/lib/auth/current-user";
import { fail, ok } from "@/lib/http/respond";
import { listAuditLogs } from "@/lib/services/audit";

export async function GET(req: Request) {
  try {
    await requireUser();
    const url = new URL(req.url);
    const entity = url.searchParams.get("entity") ?? undefined;
    const entityId = url.searchParams.get("entityId") ?? undefined;
    const userId = url.searchParams.get("userId") ?? undefined;
    const limit = Number(url.searchParams.get("limit") ?? "100");
    const offset = Number(url.searchParams.get("offset") ?? "0");
    return ok(await listAuditLogs({ entity, entityId, userId, limit, offset }));
  } catch (e) {
    return fail(e);
  }
}
