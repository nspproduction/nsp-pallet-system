import { requireUser } from "@/lib/auth/current-user";
import { listRequests, countRequests } from "@/lib/services/request";
import { PageHeader, Card, Table, StatusBadge, EmptyState } from "@/app/_components/ui";
import Link from "next/link";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  ISSUE: "เบิกออก",
  RETURN: "คืนเข้า",
  SHIP_CUSTOMER: "ส่งลูกค้า",
  RETURN_CUSTOMER: "รับคืนจากลูกค้า",
  SEND_REPAIR: "ส่งซ่อม",
  RECEIVE_REPAIR: "รับคืนจากซ่อม",
  WRITE_OFF: "ตัดจำหน่าย",
  ADJUSTMENT: "ปรับยอด",
};

const STATUSES = ["PENDING_DEPT", "PENDING_WAREHOUSE", "COMPLETED", "REJECTED", "CANCELLED"] as const;
type Status = typeof STATUSES[number];

const STATUS_LABEL: Record<string, string> = {
  PENDING_DEPT: "รอแผนก",
  PENDING_WAREHOUSE: "รอคลัง",
  COMPLETED: "อนุมัติ",
  REJECTED: "ปฏิเสธ",
  CANCELLED: "ยกเลิก",
};

const PAGE_SIZE = 20;

function isStatus(s: unknown): s is Status {
  return typeof s === "string" && (STATUSES as readonly string[]).includes(s);
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  await requireUser();
  const p = await searchParams;
  const status = isStatus(p.status) ? p.status : undefined;
  const requestedPage = Math.max(1, parseInt(p.page ?? "1", 10) || 1);

  const [total, listRaw] = await Promise.all([
    countRequests({ status }),
    listRequests({
      status,
      limit: PAGE_SIZE,
      offset: (requestedPage - 1) * PAGE_SIZE,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  // If requestedPage was out of range, re-fetch for the clamped page
  const list = requestedPage > totalPages
    ? await listRequests({ status, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE })
    : listRaw;

  const start = (page - 1) * PAGE_SIZE;
  const end = Math.min(start + PAGE_SIZE, total);

  function pageHref(targetPage: number): string {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (targetPage > 1) params.set("page", String(targetPage));
    const qs = params.toString();
    return qs ? `/manage/requests?${qs}` : "/manage/requests";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="คำขอทั้งหมด"
        subtitle={status ? `กรอง: ${STATUS_LABEL[status] ?? status}` : "ทุกสถานะ"}
      />

      <div className="flex flex-wrap gap-2">
        <Link
          href="/manage/requests"
          className={`rounded-full px-3 py-1 text-xs ${
            !status ? "bg-brand-600 text-white" : "border border-slate-200 bg-white text-slate-700"
          }`}
        >
          ทั้งหมด
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/manage/requests?status=${s}`}
            className={`rounded-full px-3 py-1 text-xs ${
              status === s ? "bg-brand-600 text-white" : "border border-slate-200 bg-white text-slate-700"
            }`}
          >
            {STATUS_LABEL[s] ?? s}
          </Link>
        ))}
      </div>

      {total === 0 ? (
        <Card><EmptyState title="ไม่มีคำขอ" /></Card>
      ) : (
        <Card>
          <Table head={["เลขที่", "ประเภท", "ผู้ร้องขอ", "จาก → ไป", "รายการ", "สถานะ", "สร้างเมื่อ"]}>
            {list.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/manage/requests/${r.id}`} className="font-mono text-xs font-medium text-brand-700 hover:text-brand-900">
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

          <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">
              แสดง {(start + 1).toLocaleString("th-TH")}–{end.toLocaleString("th-TH")} จาก{" "}
              {total.toLocaleString("th-TH")} รายการ
            </p>
            <div className="flex items-center gap-2">
              <PageLink href={pageHref(page - 1)} disabled={page === 1} label="← ก่อนหน้า" />
              <span className="text-xs font-medium text-slate-600">
                หน้า {page} / {totalPages}
              </span>
              <PageLink href={pageHref(page + 1)} disabled={page === totalPages} label="ถัดไป →" />
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function PageLink({ href, disabled, label }: { href: string; disabled: boolean; label: string }) {
  const cls = "h-8 rounded-lg border border-border bg-white px-3 text-xs font-medium flex items-center";
  if (disabled) {
    return <span className={`${cls} cursor-not-allowed text-slate-400 opacity-60`}>{label}</span>;
  }
  return (
    <Link href={href} className={`${cls} text-slate-700 hover:bg-slate-50`}>
      {label}
    </Link>
  );
}
