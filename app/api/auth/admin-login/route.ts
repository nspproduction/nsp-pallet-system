import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { setSessionCookie } from "@/lib/auth/session";
import { fail, ok, readJson } from "@/lib/http/respond";
import { HttpError } from "@/lib/auth/current-user";
import { verifyPassword } from "@/lib/auth/password";

const Body = z.object({
  username: z.string().min(1).max(80),
  password: z.string().min(1).max(200),
});

// POST /api/auth/admin-login
// Username = employeeCode. Only works for ADMIN role + ACTIVE status + passwordHash set.
export async function POST(req: Request) {
  try {
    const body = Body.parse(await readJson(req));
    const user = await prisma.user.findUnique({
      where: { employeeCode: body.username.trim() },
    });

    // Generic error to avoid username enumeration.
    const invalid = new HttpError(401, "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");

    if (!user) throw invalid;
    if (user.role !== "ADMIN") throw invalid;
    if (user.status !== "ACTIVE") throw new HttpError(403, `บัญชีถูก${user.status === "DISABLED" ? "ระงับ" : "รออนุมัติ"}`);
    if (!user.passwordHash) throw invalid;

    const okPassword = await verifyPassword(body.password, user.passwordHash);
    if (!okPassword) throw invalid;

    await setSessionCookie(user.id);
    return ok({ id: user.id, fullName: user.fullName, role: user.role });
  } catch (e) {
    return fail(e);
  }
}
