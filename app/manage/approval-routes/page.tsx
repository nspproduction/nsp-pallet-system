import { requireUser } from "@/lib/auth/current-user";
import { listRoutes } from "@/lib/services/approval-route";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/app/_components/ui";
import { ApprovalRoutesClient } from "./client";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireUser();
  const routes = await listRoutes();
  const departments = await prisma.department.findMany({ where: { active: true, isWarehouse: false }, orderBy: { name: "asc" } });
  const users = await prisma.user.findMany({
    where: { status: "ACTIVE", roles: { has: "DEPT_APPROVER" } },
    select: { id: true, fullName: true, departmentId: true },
    orderBy: { fullName: "asc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approval Route"
        subtitle="กำหนดขั้นตอนการอนุมัติคำขอแยกตามแผนก × ประเภทคำขอ"
      />
      <ApprovalRoutesClient routes={routes} departments={departments} approvers={users} />
    </div>
  );
}
