import nodemailer, { type Transporter } from "nodemailer";
import { prisma } from "@/lib/prisma";

function getTransporter(): Transporter | null {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}

const FROM = () =>
  `Noritake Pallet <${process.env.GMAIL_USER ?? "noreply@gmail.com"}>`;

export async function processEmailOutbox(batchSize = 20): Promise<{ sent: number; failed: number }> {
  const transporter = getTransporter();
  if (!transporter) return { sent: 0, failed: 0 };

  const pending = await prisma.emailOutbox.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: batchSize,
  });

  let sent = 0;
  let failed = 0;

  for (const email of pending) {
    try {
      await transporter.sendMail({
        from: FROM(),
        to: email.to,
        subject: email.subject,
        html: email.bodyHtml,
      });
      await prisma.emailOutbox.update({
        where: { id: email.id },
        data: { status: "SENT", sentAt: new Date(), attempts: { increment: 1 } },
      });
      sent++;
    } catch (err) {
      await prisma.emailOutbox.update({
        where: { id: email.id },
        data: {
          status: "FAILED",
          lastError: err instanceof Error ? err.message : String(err),
          attempts: { increment: 1 },
        },
      });
      failed++;
    }
  }

  return { sent, failed };
}
