import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { setSessionCookie } from "@/lib/auth/session";
import { fail, ok, readJson } from "@/lib/http/respond";
import { HttpError } from "@/lib/auth/current-user";
import { verifyPassword } from "@/lib/auth/password";
import { writeAudit } from "@/lib/services/audit";

const Body = z.object({
  email:    z.string().min(1).max(200),
  password: z.string().min(1).max(200),
});

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

export async function POST(req: Request) {
  try {
    const body = Body.parse(await readJson(req));
    const user = await prisma.user.findFirst({
      where: { email: { equals: body.email.trim(), mode: "insensitive" } },
    });

    const invalid = new HttpError(401, "อีเมลหรือรหัสผ่านไม่ถูกต้อง");

    if (!user) throw invalid;

    // Check lockout (SPEC §10)
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw new HttpError(403, `บัญชีถูกล็อกชั่วคราว กรุณาลองใหม่ใน ${mins} นาที`);
    }

    if (user.status === "DISABLED") throw new HttpError(403, "บัญชีถูกระงับการใช้งาน");
    if (user.status !== "ACTIVE")   throw new HttpError(403, "รออนุมัติบัญชีจากผู้ดูแลระบบ");
    if (!user.passwordHash)         throw invalid;

    const okPassword = await verifyPassword(body.password, user.passwordHash);

    if (!okPassword) {
      const newAttempts = user.failedLoginAttempts + 1;
      const willLock = newAttempts >= MAX_FAILED;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: newAttempts,
          lockedUntil: willLock
            ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000)
            : null,
        },
      });
      await writeAudit({
        userId: user.id,
        entity: "user",
        entityId: user.id,
        action: willLock ? "account_locked" : "login_failed",
        after: { attempts: newAttempts, locked: willLock },
      });
      if (willLock) {
        throw new HttpError(403, `รหัสผ่านผิดเกิน ${MAX_FAILED} ครั้ง บัญชีถูกล็อก ${LOCK_MINUTES} นาที`);
      }
      const remaining = MAX_FAILED - newAttempts;
      throw new HttpError(401, `อีเมลหรือรหัสผ่านไม่ถูกต้อง (เหลืออีก ${remaining} ครั้งก่อนถูกล็อก)`);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });

    await setSessionCookie(user.id);
    return ok({ id: user.id, fullName: user.fullName, roles: user.roles });
  } catch (e) {
    return fail(e);
  }
}
