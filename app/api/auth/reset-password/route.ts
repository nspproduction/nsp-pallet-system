// Library
import { createHash } from "node:crypto";

// Lib
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { fail, ok, readJson } from "@/lib/http/respond";
import { HttpError } from "@/lib/auth/current-user";
import { queueEmail, buildUserEmail } from "@/lib/services/email-outbox";

// GET /api/auth/reset-password?token=xxx — verify token only (no side effects)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const rawToken = searchParams.get("token") ?? "";
    if (!rawToken) throw new HttpError(400, "ไม่พบ token");

    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const record = await prisma.passwordResetToken.findFirst({
      where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } }
    });

    if (!record) throw new HttpError(400, "ลิงก์หมดอายุหรือใช้ไปแล้ว");
    return ok({ valid: true });
  } catch (e) {
    return fail(e);
  }
}

// POST /api/auth/reset-password
// Body: { token: string; password: string }
export async function POST(req: Request) {
  try {
    const body = await readJson<{ token?: unknown; password?: unknown }>(req);

    const rawToken = typeof body.token === "string" ? body.token.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!rawToken) {
      throw new HttpError(400, "ลิงก์หมดอายุหรือใช้ไปแล้ว");
    }

    if (password.length < 8) {
      throw new HttpError(400, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
    }

    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const now = new Date();

    // Find token first to get userId — actual consumption is atomic below
    const resetToken = await prisma.passwordResetToken.findFirst({
      where: { tokenHash, usedAt: null, expiresAt: { gt: now } }
    });

    if (!resetToken) {
      throw new HttpError(400, "ลิงก์หมดอายุหรือใช้ไปแล้ว");
    }

    const newPasswordHash = await hashPassword(password);

    // Atomically mark token as used — if count=0 a concurrent request already consumed it
    const consumed = await prisma.passwordResetToken.updateMany({
      where: { id: resetToken.id, usedAt: null },
      data: { usedAt: now }
    });
    if (consumed.count === 0) {
      throw new HttpError(400, "ลิงก์หมดอายุหรือใช้ไปแล้ว");
    }

    const user = await prisma.user.findUnique({ where: { id: resetToken.userId } });

    await prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash: newPasswordHash }
    });

    if (user?.email) {
      const appUrl = process.env.APP_URL ?? "";
      await queueEmail(
        prisma,
        user.email,
        "รหัสผ่านของคุณถูกเปลี่ยนแล้ว — ระบบพาเลท",
        buildUserEmail({
          title: "เปลี่ยนรหัสผ่านสำเร็จ",
          bodyLines: [
            `สวัสดีคุณ <strong>${user.fullName}</strong>`,
            "รหัสผ่านของบัญชีคุณถูกเปลี่ยนเรียบร้อยแล้ว คุณสามารถเข้าสู่ระบบด้วยรหัสผ่านใหม่ได้ทันที",
            "<strong>หากคุณไม่ได้ดำเนินการนี้</strong> กรุณาติดต่อผู้ดูแลระบบทันที เนื่องจากบัญชีของคุณอาจถูกเข้าถึงโดยผู้อื่น"
          ],
          ctaText: "เข้าสู่ระบบ",
          ctaUrl: `${appUrl}/auth/login`
        })
      );
    }

    return ok({ reset: true });
  } catch (e) {
    return fail(e);
  }
}
