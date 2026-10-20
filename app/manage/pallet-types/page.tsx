import { requireUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, Table, StatusBadge, EmptyState } from "@/app/_components/ui";
import { PalletTypeAdd, PalletTypeEdit } from "./client";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireUser();
  const list = await prisma.palletType.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="space-y-6">
      <PageHeader
        title="ประเภทพาเลท"
        subtitle="กำหนดชนิดพาเลทที่ใช้ในระบบ"
        actions={<PalletTypeAdd />}
      />

      {list.length === 0 ? (
        <Card>
          <EmptyState title="ยังไม่มีข้อมูล" subtitle="เพิ่มประเภทพาเลทแรกเพื่อเริ่มใช้งาน" />
        </Card>
      ) : (
        <Card>
          <Table head={["ชื่อ", "ขนาด", "สถานะ", ""]}>
            {list.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3 font-medium text-slate-900">{p.name}</td>
                <td className="px-4 py-3 text-slate-600">{p.sizeSpec ?? "-"}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={p.active ? "ACTIVE" : "DISABLED"} />
                </td>
                <td className="px-4 py-3 text-right">
                  <PalletTypeEdit initial={p} />
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
    </div>
  );
}
