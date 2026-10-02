import { requireUser } from "@/lib/auth/current-user";
import { listRequests } from "@/lib/services/request";
import { PageHeader, Card, Table, StatusBadge, EmptyState } from "@/app/_components/ui";
import Link from "next/link";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  RECEIVE_NEW: "รับเข้าใหม่",
  ISSUE_INTERNAL: "เบิกใช้ภายใน",
  RETURN_INTERNAL: "คืนจากภายใน",
  SHIP_CUSTOMER: "ส่งลูกค้า",
  RETURN_CUSTOMER: "รับคืนจากลูกค้า",
  SEND_REPAIR: "ส่งซ่อม",
  RECEIVE_REPAIR: "รับคืนจากซ่อม",
  WRITE_OFF: "ตัดจำหน่าย",
  ADJUSTMENT: "ปรับยอด",
};

const STATUSES = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;
type Status = typeof STATUSES[number];

function isStatus(s: unknown): s is Status {
  return typeof s === "string" && (STATUSES as readonly string[]).includes(s);
}

export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireUser();
  const p = await searchParams;
  const status = isStatus(p.status) ? p.status : undefined;

  const list = await listRequests({ status, limit: 100 });

  return (
    <div className="space-y-6">
      <PageHeader title="คำขอทั้งหมด" subtitle={status ? `กรอง: ${status}` : "ทุกสถานะ"} />

      <div className="flex flex-wrap gap-2">
        <Link
          href="/admin/requests"
          className={`rounded-full px-3 py-1 text-xs ${
            !status ? "bg-brand-600 text-white" : "border border-slate-200 bg-white text-slate-700"
          }`}
        >
          ทั้งหมด
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/requests?status=${s}`}
            className={`rounded-full px-3 py-1 text-xs ${
              status === s ? "bg-brand-600 text-white" : "border border-slate-200 bg-white text-slate-700"
            }`}
          >
            {s}
          </Link>
        ))}
      </div>

      {list.length === 0 ? (
        <Card><EmptyState title="ไม่มีคำขอ" /></Card>
      ) : (
        <Card>
          <Table head={["เลขที่", "ประเภท", "ผู้ร้องขอ", "จาก → ไป", "รายการ", "สถานะ", "สร้างเมื่อ"]}>
            {list.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/admin/requests/${r.id}`} className="font-mono text-xs font-medium text-brand-700 hover:text-brand-900">
                    {r.docNo}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-700">{TYPE_LABEL[r.type] ?? r.type}</td>
                <td className="px-4 py-3 text-slate-700">{r.requester.fullName}</td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {r.fromDepartment?.name ?? "-"} → {r.toDepartment?.name ?? "-"}
                </td>
                <td className="px-4 py-3 text-slate-600">{r.items.length}</td>
                <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                <td className="px-4 py-3 text-xs text-slate-500">{r.createdAt.toLocaleString("th-TH")}</td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
    </div>
  );
}
