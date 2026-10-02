import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { setSessionCookie } from "@/lib/auth/session";
import { fail, ok, readJson } from "@/lib/http/respond";
import { HttpError } from "@/lib/auth/current-user";

const Body = z.object({ employeeCode: z.string().min(1) });

// DEV-ONLY: login by employeeCode without password.
// Gated on NODE_ENV !== production. Never enable in prod.
export async function POST(req: Request) {
  try {
    if (process.env.NODE_ENV === "production") {
      throw new HttpError(403, "dev-login disabled in production");
    }
    const body = Body.parse(await readJson(req));
    const user = await prisma.user.findUnique({ where: { employeeCode: body.employeeCode } });
    if (!user) throw new HttpError(404, "ไม่พบผู้ใช้");
    if (user.status !== "ACTIVE") throw new HttpError(403, `สถานะผู้ใช้: ${user.status}`);
    await setSessionCookie(user.id);
    return ok({ id: user.id, fullName: user.fullName, role: user.role });
  } catch (e) {
    return fail(e);
  }
}
