import { requireUser } from "@/lib/auth/current-user";
import { fail, ok } from "@/lib/http/respond";
import { getRequestWarnings } from "@/lib/services/request";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    const warnings = await getRequestWarnings(id);
    return ok({ warnings });
  } catch (e) {
    return fail(e);
  }
}
