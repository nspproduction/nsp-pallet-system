// Lib
import { requireUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";

// Components
import { PageHeader, Card, Table, StatusBadge, EmptyState } from "@/app/_components/ui";
import { DepartmentAdd, DepartmentEdit, DepartmentToggle, SectionsManager } from "./client";

export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const list = await prisma.department.findMany({
    orderBy: [{ active: "desc" }, { code: "asc" }],
    include: {
      _count: { select: { users: true } },
      sections: { orderBy: [{ active: "desc" }, { code: "asc" }] },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="แผนก"
        subtitle="แผนกหลักในโรงงาน · section ย่อยสำหรับไลน์ผลิต / กลุ่มงาน"
        actions={isAdmin ? <DepartmentAdd /> : null}
      />
      {list.length === 0 ? (
        <Card><EmptyState title="ยังไม่มีข้อมูล" /></Card>
      ) : (
        <Card>
          <Table head={["รหัส", "ชื่อ", "ผู้ใช้", "Sections", "สถานะ", ""]}>
            {list.map((d) => (
              <tr key={d.id}>
                <td className="px-4 py-3 font-mono text-xs text-slate-600">{d.code}</td>
                <td className="px-4 py-3 font-medium text-slate-900">{d.name}</td>
                <td className="px-4 py-3 text-slate-600">{d._count.users}</td>
                <td className="px-4 py-3">
                  {isAdmin ? (
                    <SectionsManager
                      departmentId={d.id}
                      departmentName={d.name}
                      sections={d.sections.map((s) => ({
                        id: s.id,
                        code: s.code,
                        name: s.name,
                        active: s.active,
                      }))}
                    />
                  ) : (
                    <span className="text-xs text-slate-500">{d.sections.length} รายการ</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={d.active ? "ACTIVE" : "DISABLED"} />
                </td>
                <td className="px-4 py-3 text-right">
                  {isAdmin && (
                    <div className="flex justify-end gap-2">
                      <DepartmentToggle id={d.id} active={d.active} name={d.name} />
                      <DepartmentEdit initial={{ id: d.id, code: d.code, name: d.name, active: d.active }} />
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
    </div>
  );
}
