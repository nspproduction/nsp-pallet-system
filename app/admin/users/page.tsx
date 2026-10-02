// Lib
import { requireUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";

// Components
import { PageHeader, Card, Table, StatusBadge, EmptyState } from "@/app/_components/ui";
import { UserEdit } from "./client";

export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const [list, departments] = await Promise.all([
    prisma.user.findMany({
      include: { department: true, section: true },
      orderBy: [{ status: "asc" }, { fullName: "asc" }],
    }),
    prisma.department.findMany({ orderBy: { code: "asc" } }),
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
          <Table head={["ชื่อ", "รหัสพนักงาน", "บทบาท", "แผนก / Section", "สถานะ", "LINE", ""]}>
            {list.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3 font-medium text-slate-900">{u.fullName}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-600">{u.employeeCode}</td>
                <td className="px-4 py-3 text-slate-600">{u.role}</td>
                <td className="px-4 py-3 text-slate-600">
                  {u.department?.name ?? "-"}
                  {u.section && <span className="ml-1 text-xs text-slate-500">· {u.section.name}</span>}
                </td>
                <td className="px-4 py-3"><StatusBadge status={u.status} /></td>
                <td className="px-4 py-3 text-slate-500 text-xs">
                  {u.lineUserId
                    ? <span className="text-emerald-700">✓ เชื่อม</span>
                    : <span className="text-slate-400">-</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  {isAdmin && <UserEdit initial={u} departments={departments} />}
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
    </div>
  );
}
