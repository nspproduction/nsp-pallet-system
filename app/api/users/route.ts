import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, requireUser } from "@/lib/auth/current-user";
import { fail, ok } from "@/lib/http/respond";

export async function GET(req: Request) {
  try {
    await requireUser();
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const role = url.searchParams.get("role");
    const list = await prisma.user.findMany({
      where: {
        status: z.enum(["PENDING", "ACTIVE", "DISABLED"]).optional().parse(status ?? undefined),
        role: z.enum(["REQUESTER", "APPROVER", "ADMIN", "VIEWER"]).optional().parse(role ?? undefined),
      },
      include: { department: true },
      orderBy: [{ status: "asc" }, { fullName: "asc" }],
    });
    return ok(list);
  } catch (e) {
    return fail(e);
  }
}

export async function POST() {
  // Users are auto-provisioned via /api/auth/line. Manual creation is discouraged.
  try {
    await requireRole("ADMIN");
    return Response.json({ error: "manual_user_creation_disabled" }, { status: 405 });
  } catch (e) {
    return fail(e);
  }
}
