import { z } from "zod";
import { verifyLineIdToken } from "@/lib/liff/verify";
import { prisma } from "@/lib/prisma";
import { setSessionCookie } from "@/lib/auth/session";
import { fail, ok, readJson } from "@/lib/http/respond";

const Body = z.object({
  idToken: z.string().min(10),
});

// POST /api/auth/line
// Verify LIFF ID token → upsert User (PENDING for first-timers) → set session cookie.
// A PENDING user still gets a session but must be ACTIVATED by admin to actually use the app.
export async function POST(request: Request) {
  try {
    const body = Body.parse(await readJson(request));
    const claims = await verifyLineIdToken(body.idToken);

    const lineUserId = claims.sub;
    const displayName = claims.name?.trim() || "";

    let user = await prisma.user.findUnique({ where: { lineUserId } });
    if (!user) {
      // Auto-provision stub user. The real info (fullName/phone/department) is
      // collected on /liff/register. We seed fullName from LINE display name as
      // a hint; the user can edit it. phone/department are null → needsRegistration = true.
      user = await prisma.user.create({
        data: {
          lineUserId,
          employeeCode: `LINE-${lineUserId.slice(-8)}`,
          fullName: displayName || "ยังไม่ได้ลงทะเบียน",
          role: "REQUESTER",
          status: "PENDING",
        },
      });
    }

    await setSessionCookie(user.id);

    return ok({
      id: user.id,
      lineUserId: user.lineUserId,
      fullName: user.fullName,
      status: user.status,
      role: user.role,
      known: user.status === "ACTIVE",
    });
  } catch (e) {
    return fail(e);
  }
}
