import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/http/respond";
import { HttpError } from "@/lib/auth/current-user";

// DEV-ONLY: list active users for the dev-login dropdown.
// Gated on NODE_ENV !== production.
export async function GET() {
  try {
    if (process.env.NODE_ENV === "production") {
      throw new HttpError(403, "dev-users disabled in production");
    }
    const list = await prisma.user.findMany({
      where: { status: "ACTIVE" },
      select: {
        email: true,
        fullName: true,
        roles: true,
        department: { select: { name: true } },
      },
      orderBy: [{ email: "asc" }],
    });
    return ok(list);
  } catch (e) {
    return fail(e);
  }
}
