import { getSessionUserAnyStatus } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getSessionUserAnyStatus();
  if (!user) return Response.json({ authenticated: false }, { status: 401 });

  const [department, section] = await Promise.all([
    user.departmentId
      ? prisma.department.findUnique({
          where: { id: user.departmentId },
          select: { id: true, code: true, name: true },
        })
      : Promise.resolve(null),
    user.sectionId
      ? prisma.departmentSection.findUnique({
          where: { id: user.sectionId },
          select: { id: true, code: true, name: true },
        })
      : Promise.resolve(null),
  ]);

  // needsRegistration: user เพิ่งถูก provision จาก LINE login
  // แต่ยังไม่ได้กรอกข้อมูลลงทะเบียน (phone / department)
  const needsRegistration = !user.phone || !user.departmentId;

  return Response.json({
    authenticated: true,
    needsRegistration,
    user: {
      id: user.id,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      status: user.status,
      lineUserId: user.lineUserId,
      employeeCode: user.employeeCode,
      departmentId: user.departmentId,
      sectionId: user.sectionId,
      department,
      section,
    },
  });
}
