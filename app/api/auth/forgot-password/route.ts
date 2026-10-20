// Library
import { randomBytes, createHash } from "node:crypto";

// Lib
import { prisma } from "@/lib/prisma";
import { fail, ok, readJson } from "@/lib/http/respond";
import { queueEmail, buildUserEmail } from "@/lib/services/email-outbox";

// POST /api/auth/forgot-password
// Body: { email: string }
// Always returns 200 to avoid leaking whether an email exists.
export async function POST(req: Request) {
  try {
    const body = await readJson<{ email?: unknown }>(req);
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!email) {
      return ok({ sent: true });
    }

    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } }
    });

    if (!user) {
      return ok({ sent: true });
    }

    // Rate limit: max 3 reset requests per 15 minutes per user
    const windowStart = new Date(Date.now() - 15 * 60 * 1000);
    const recentCount = await prisma.passwordResetToken.count({
      where: { userId: user.id, createdAt: { gte: windowStart } }
    });
    if (recentCount >= 3) {
      return ok({ sent: true });
    }

    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
        usedAt: null
      }
    });

    const appUrl = process.env.APP_URL ?? "";
    const resetLink = `${appUrl}/auth/reset-password?token=${rawToken}`;

    await queueEmail(
      prisma,
      user.email ?? email,
      "คำขอรีเซ็ตรหัสผ่าน — ระบบพาเลท",
      buildUserEmail({
        title: "รีเซ็ตรหัสผ่านของคุณ",
        bodyLines: [
          `สวัสดีคุณ <strong>${user.fullName}</strong>`,
          "เราได้รับคำขอรีเซ็ตรหัสผ่านสำหรับบัญชีของคุณ กรุณาคลิกปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่",
          "<strong>ลิงก์นี้จะหมดอายุภายใน 30 นาที</strong> หากไม่ได้ดำเนินการภายในเวลาที่กำหนด กรุณาขอลิงก์ใหม่อีกครั้ง"
        ],
        summaryRows: [
          { label: "อีเมล", value: user.email ?? email },
          { label: "หมดอายุใน", value: "30 นาที นับจากเวลาที่ได้รับอีเมลนี้" }
        ],
        ctaText: "รีเซ็ตรหัสผ่าน",
        ctaUrl: resetLink
      })
    );

    return ok({ sent: true });
  } catch (e) {
    return fail(e);
  }
}
