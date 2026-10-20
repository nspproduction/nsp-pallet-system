import { requireUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/http/respond";

export async function POST() {
  try {
    const user = await requireUser();
    await prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return ok({ success: true });
  } catch (err) {
    return fail(err);
  }
}
