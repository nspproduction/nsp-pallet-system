import { getSessionUserAnyStatus } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getSessionUserAnyStatus();
  if (!user) return Response.json({ authenticated: false }, { status: 401 });

  const [department, section] = await Promise.all([
    user.departmentId
      ? prisma.department.findUnique({
          where: { id: user.departmentId },
          select: { id: true, name: true, isWarehouse: true },
        })
      : Promise.resolve(null),
    user.sectionId
      ? prisma.departmentSection.findUnique({
          where: { id: user.sectionId },
          select: { id: true, name: true },
        })
      : Promise.resolve(null),
  ]);

  return Response.json({
    authenticated: true,
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      roles: user.roles,
      status: user.status,
      departmentId: user.departmentId,
      sectionId: user.sectionId,
      department,
      section,
    },
  });
}
