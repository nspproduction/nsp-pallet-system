import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { fail, ok, readJson } from "@/lib/http/respond";
import { HttpError } from "@/lib/auth/current-user";
import { writeAudit } from "@/lib/services/audit";
import { notifyNewUserToAdmins } from "@/lib/services/notification";

const Body = z.object({
  email:        z.string().email("อีเมลไม่ถูกต้อง").max(200),
  password:     z.string().min(8, "รหัสผ่านอย่างน้อย 8 ตัวอักษร").max(200),
  fullName:     z.string().min(1).max(120),
  phone:        z.string().min(1).max(40),
  departmentId: z.string().min(1),
  sectionId:    z.string().optional().nullable(),
});

// POST /api/auth/register — public endpoint, creates a PENDING user.
export async function POST(request: Request) {
  try {
    const data = Body.parse(await readJson(request));

    const dup = await prisma.user.findFirst({
      where: { email: { equals: data.email, mode: "insensitive" } },
    });
    if (dup) throw new HttpError(400, "อีเมลนี้ถูกใช้งานแล้ว");

    const dept = await prisma.department.findUnique({ where: { id: data.departmentId } });
    if (!dept?.active) throw new HttpError(400, "ไม่พบแผนก หรือแผนกถูกปิดใช้งาน");

    if (data.sectionId) {
      const section = await prisma.departmentSection.findUnique({ where: { id: data.sectionId } });
      if (!section?.active)                            throw new HttpError(400, "ไม่พบ section หรือถูกปิดใช้งาน");
      if (section.departmentId !== data.departmentId)  throw new HttpError(400, "section ไม่อยู่ในแผนกที่เลือก");
    }

    const passwordHash = await hashPassword(data.password);

    const user = await prisma.user.create({
      data: {
        email:        data.email.toLowerCase(),
        passwordHash,
        fullName:     data.fullName,
        phone:        data.phone,
        departmentId: data.departmentId,
        sectionId:    data.sectionId ?? null,
        roles:        ["REQUESTER"],
        status:       "PENDING",
      },
    });

    await writeAudit({ entity: "user", entityId: user.id, action: "register", after: { email: user.email } });

    notifyNewUserToAdmins(user.id).catch(() => {});

    return ok({ id: user.id, status: user.status });
  } catch (e) {
    return fail(e);
  }
}
