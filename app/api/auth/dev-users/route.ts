import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/http/respond";
import { HttpError } from "@/lib/auth/current-user";

// DEV-ONLY: list active users for the dev-login dropdown.
// Gated on NODE_ENV !== production. Excludes LINE-provisioned accounts
// (those should log in via LIFF, not dev-login).
export async function GET() {
  try {
    if (process.env.NODE_ENV === "production") {
      throw new HttpError(403, "dev-users disabled in production");
    }
    const list = await prisma.user.findMany({
      where: {
        status: "ACTIVE",
        NOT: { employeeCode: { startsWith: "LINE-" } },
      },
      select: {
        employeeCode: true,
        fullName: true,
        role: true,
        department: { select: { code: true, name: true } },
      },
      orderBy: [{ role: "asc" }, { employeeCode: "asc" }],
    });
    return ok(list);
  } catch (e) {
    return fail(e);
  }
}
