// Lib
import { requireUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";

// Components
import { PageHeader, Card, Table, StatusBadge, EmptyState } from "@/app/_components/ui";
import { DepartmentAdd, DepartmentEdit, DepartmentToggle, SectionsManager } from "./client";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireUser();
  const list = await prisma.department.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: {
      _count: { select: { users: true } },
      sections: { orderBy: [{ active: "desc" }, { name: "asc" }] },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="แผนก"
        subtitle="แผนกหลักในโรงงาน · section ย่อยสำหรับไลน์ผลิต / กลุ่มงาน"
        actions={<DepartmentAdd />}
      />
      {list.length === 0 ? (
        <Card><EmptyState title="ยังไม่มีข้อมูล" /></Card>
      ) : (
        <Card>
          <Table head={["ชื่อ", "ผู้ใช้", "Sections", "สถานะ", ""]}>
            {list.map((d) => (
              <tr key={d.id}>
                <td className="px-4 py-3 font-medium text-slate-900">
                  <span className="flex items-center gap-2">
                    {d.name}
                    {d.isWarehouse && (
                      <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200">
                        ระบบ
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{d._count.users}</td>
                <td className="px-4 py-3">
                  <SectionsManager
                    departmentId={d.id}
                    departmentName={d.name}
                    sections={d.sections.map((s) => ({
                      id: s.id,
                      name: s.name,
                      active: s.active,
                    }))}
                  />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={d.active ? "ACTIVE" : "DISABLED"} />
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    {!d.isWarehouse && (
                      <DepartmentToggle id={d.id} active={d.active} name={d.name} />
                    )}
                    <DepartmentEdit initial={{ id: d.id, name: d.name, active: d.active, isWarehouse: d.isWarehouse }} />
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
    </div>
  );
}
