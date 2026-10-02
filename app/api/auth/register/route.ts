import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUserAnyStatus, HttpError } from "@/lib/auth/current-user";
import { fail, ok, readJson } from "@/lib/http/respond";
import { writeAudit } from "@/lib/services/audit";

const Body = z.object({
  fullName: z.string().min(1).max(120),
  phone: z.string().min(1).max(40),
  departmentId: z.string().min(1),
  sectionId: z.string().optional().nullable(),
});

// POST /api/auth/register
// First-time registration after LINE login. Only works for the current session user.
// Sets fullName / phone / departmentId / sectionId. Status stays PENDING until admin approves.
export async function POST(request: Request) {
  try {
    const user = await getSessionUserAnyStatus();
    if (!user) throw new HttpError(401, "unauthenticated");

    const data = Body.parse(await readJson(request));

    // Validate department exists + active
    const dept = await prisma.department.findUnique({ where: { id: data.departmentId } });
    if (!dept || !dept.active) throw new HttpError(400, "ไม่พบแผนก หรือแผนกถูกปิดใช้งาน");

    // Validate section if provided
    if (data.sectionId) {
      const section = await prisma.departmentSection.findUnique({ where: { id: data.sectionId } });
      if (!section || !section.active) throw new HttpError(400, "ไม่พบ section หรือถูกปิดใช้งาน");
      if (section.departmentId !== data.departmentId) {
        throw new HttpError(400, "section ไม่อยู่ในแผนกที่เลือก");
      }
    }

    const before = { ...user };
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        fullName: data.fullName,
        phone: data.phone,
        departmentId: data.departmentId,
        sectionId: data.sectionId ?? null,
        // ให้ status PENDING รออนุมัติ (ยกเว้นเคย ACTIVE อยู่แล้ว — admin เคยอนุมัติไว้)
        status: user.status === "ACTIVE" ? "ACTIVE" : "PENDING",
      },
    });

    await writeAudit({
      userId: user.id,
      entity: "user",
      entityId: user.id,
      action: "register",
      before,
      after: updated,
    });

    return ok({
      id: updated.id,
      status: updated.status,
      fullName: updated.fullName,
    });
  } catch (e) {
    return fail(e);
  }
}
