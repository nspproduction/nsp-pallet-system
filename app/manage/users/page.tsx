// Lib
import { requireUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";

// Components
import { PageHeader, Card, Table, StatusBadge, EmptyState } from "@/app/_components/ui";
import { UserEdit } from "./client";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  REQUESTER:      "ผู้ร้องขอ",
  DEPT_APPROVER:  "ผู้อนุมัติแผนก",
  VIEWER:         "ดูอย่างเดียว",
  PALLET_MANAGER: "ผู้อนุมัติพาเลท",
  ADMIN:          "ผู้ดูแลระบบ",
};

export default async function Page() {
  const user = await requireUser();
  const [list, departments] = await Promise.all([
    prisma.user.findMany({
      include: { department: true, section: true },
      orderBy: [{ status: "asc" }, { fullName: "asc" }],
    }),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="ผู้ใช้ & สิทธิ์"
        subtitle="ผู้ใช้ทั้งหมด · อนุมัติ PENDING · เปลี่ยน role / status / section"
      />
      {list.length === 0 ? (
        <Card><EmptyState title="ยังไม่มีผู้ใช้" /></Card>
      ) : (
        <Card>
          <Table head={["ชื่อ", "อีเมล", "บทบาท", "แผนก / Section", "สถานะ", ""]}>
            {list.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3 font-medium text-slate-900">{u.fullName}</td>
                <td className="px-4 py-3 text-xs text-slate-600">{u.email}</td>
                <td className="px-4 py-3 text-slate-600">{u.roles.map((r) => ROLE_LABEL[r] ?? r).join(", ")}</td>
                <td className="px-4 py-3 text-slate-600">
                  {u.department?.name ?? "-"}
                  {u.section && <span className="ml-1 text-xs text-slate-500">· {u.section.name}</span>}
                </td>
                <td className="px-4 py-3"><StatusBadge status={u.status} /></td>
                <td className="px-4 py-3 text-right">
                  <UserEdit initial={u} departments={departments} currentUserId={user.id} />
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
    </div>
  );
}
