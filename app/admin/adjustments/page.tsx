import { requireUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, Table, EmptyState } from "@/app/_components/ui";
import { AdjustmentsClient } from "./client";

export const dynamic = "force-dynamic";

const CONDITION_LABEL: Record<string, string> = {
  USABLE: "ดี",
  IN_REPAIR: "ส่งซ่อม",
  UNUSABLE: "เสีย",
};

export default async function Page() {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";

  const [list, palletTypes, departments] = await Promise.all([
    prisma.stockMovement.findMany({
      where: { reason: { startsWith: "[ADJUST]" } },
      include: {
        palletType: { select: { code: true, name: true } },
        fromDepartment: { select: { code: true, name: true } },
        toDepartment: { select: { code: true, name: true } },
      },
      orderBy: { occurredAt: "desc" },
      take: 100,
    }),
    prisma.palletType.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
    prisma.department.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="ปรับยอด"
        subtitle="ปรับยอดสต็อกเมื่อพบความคลาดเคลื่อน (บันทึก audit เต็ม)"
        actions={isAdmin ? <AdjustmentsClient palletTypes={palletTypes} departments={departments} /> : null}
      />
      {list.length === 0 ? (
        <Card><EmptyState title="ยังไม่เคยปรับยอด" /></Card>
      ) : (
        <Card>
          <Table head={["เวลา", "พาเลท", "สถานะ", "จาก", "ไป", "จำนวน", "เหตุผล"]}>
            {list.map((m) => (
              <tr key={m.id}>
                <td className="px-4 py-3 text-xs text-slate-500">{m.occurredAt.toLocaleString("th-TH")}</td>
                <td className="px-4 py-3 font-medium text-slate-900">{m.palletType.name}</td>
                <td className="px-4 py-3 text-slate-700">{CONDITION_LABEL[m.condition] ?? m.condition}</td>
                <td className="px-4 py-3 text-slate-600">{m.fromDepartment?.name ?? "-"}</td>
                <td className="px-4 py-3 text-slate-600">{m.toDepartment?.name ?? "-"}</td>
                <td className="px-4 py-3 font-mono text-slate-900">{m.quantity}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{m.reason?.replace("[ADJUST]", "").trim()}</td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
    </div>
  );
}
