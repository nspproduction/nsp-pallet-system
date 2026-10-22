import { z } from "zod";
import { requireUser } from "@/lib/auth/current-user";
import { fail, ok } from "@/lib/http/respond";
import { resolveRoute } from "@/lib/services/approval-route";
import { prisma } from "@/lib/prisma";

// Returns the current user's active approval route (step snapshot) for
// a given request type, enriched with approver fullName so the request
// create page can render pickers without needing a separate user lookup.

const TypeQuery = z.enum(["ISSUE", "RETURN"]);

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const type = TypeQuery.parse(url.searchParams.get("type") ?? "ISSUE");

    if (!user.departmentId) {
      return ok({ steps: [] });
    }

    let steps;
    try {
      steps = await resolveRoute(user.departmentId, type);
    } catch {
      // No active route configured — the request create flow will surface
      // the server-side error on submit; here just return empty.
      return ok({ steps: [] });
    }

    const allIds = [...new Set(steps.flatMap((s) => s.approverIds))];
    const users = allIds.length
      ? await prisma.user.findMany({
          where: { id: { in: allIds }, status: "ACTIVE" },
          select: { id: true, fullName: true }
        })
      : [];
    const nameById = new Map(users.map((u) => [u.id, u.fullName]));

    return ok({
      steps: steps.map((s) => ({
        stepOrder: s.stepOrder,
        name: s.name,
        requesterPicks: s.requesterPicks ?? false,
        approvers: s.approverIds.map((id) => ({ id, fullName: nameById.get(id) ?? "⚠ ผู้ใช้ไม่พร้อม" }))
      }))
    });
  } catch (e) {
    return fail(e);
  }
}
