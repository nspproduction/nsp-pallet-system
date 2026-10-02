import { requireUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, Table, StatusBadge, EmptyState } from "@/app/_components/ui";
import { PalletTypeAdd, PalletTypeEdit } from "./client";

export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const list = await prisma.palletType.findMany({ orderBy: { code: "asc" } });

  return (
    <div className="space-y-6">
      <PageHeader
        title="ประเภทพาเลท"
        subtitle="กำหนดชนิดพาเลทที่ใช้ในระบบ · จำนวนขั้นต่ำสำหรับแจ้งเตือน"
        actions={isAdmin ? <PalletTypeAdd /> : null}
      />

      {list.length === 0 ? (
        <Card>
          <EmptyState title="ยังไม่มีข้อมูล" subtitle="เพิ่มประเภทพาเลทแรกเพื่อเริ่มใช้งาน" />
        </Card>
      ) : (
        <Card>
          <Table head={["รหัส", "ชื่อ", "วัสดุ", "ขนาด", "Min Stock", "สถานะ", ""]}>
            {list.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3 font-mono text-xs text-slate-600">{p.code}</td>
                <td className="px-4 py-3 font-medium text-slate-900">{p.name}</td>
                <td className="px-4 py-3 text-slate-600">{p.material ?? "-"}</td>
                <td className="px-4 py-3 text-slate-600">{p.sizeSpec ?? "-"}</td>
                <td className="px-4 py-3 text-slate-600">{p.minStock}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={p.active ? "ACTIVE" : "DISABLED"} />
                </td>
                <td className="px-4 py-3 text-right">
                  {isAdmin && <PalletTypeEdit initial={p} />}
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
    </div>
  );
}
