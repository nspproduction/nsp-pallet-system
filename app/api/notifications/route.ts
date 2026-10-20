import { requireUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/http/respond";

export async function GET() {
  try {
    const user = await requireUser();
    const [items, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          id: true,
          subject: true,
          body: true,
          linkUrl: true,
          readAt: true,
          createdAt: true,
        },
      }),
      prisma.notification.count({
        where: { userId: user.id, readAt: null },
      }),
    ]);
    return ok({ items, unreadCount });
  } catch (err) {
    return fail(err);
  }
}
