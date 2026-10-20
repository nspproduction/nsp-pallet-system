import Link from "next/link";
import { requireUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { listAuditLogs, countAuditLogs } from "@/lib/services/audit";
import { PageHeader, Card, EmptyState } from "@/app/_components/ui";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

const ENTITIES = [
  "request",
  "user",
  "department",
  "department_section",
  "pallet_type",
  "warehouse_operation",
  "approval_route",
  "stock_movement",
] as const;

const ENTITY_LABEL: Record<string, string> = {
  request: "คำขอ",
  user: "ผู้ใช้",
  department: "แผนก",
  department_section: "Section",
  pallet_type: "ประเภทพาเลท",
  warehouse_operation: "ปรับคลัง",
  approval_route: "ขั้นอนุมัติ",
  stock_movement: "เคลื่อนไหวสต็อก",
};

const ACTION_LABEL: Record<string, string> = {
  create: "สร้าง",
  update: "แก้ไข",
  delete: "ลบ",
  approve: "อนุมัติ",
  reject: "ปฏิเสธ",
  cancel: "ยกเลิก",
  adjust: "ปรับยอด",
  repair: "บันทึกผลซ่อม",
  write_off: "ตัดจำหน่าย",
  edit_approve: "แก้ไขและอนุมัติ",
};

const ACTION_TONE: Record<string, string> = {
  create: "bg-emerald-50 text-emerald-700",
  update: "bg-amber-50 text-amber-700",
  delete: "bg-rose-50 text-rose-700",
  approve: "bg-emerald-50 text-emerald-700",
  reject: "bg-rose-50 text-rose-700",
  cancel: "bg-slate-100 text-slate-600",
  adjust: "bg-amber-50 text-amber-700",
  repair: "bg-amber-50 text-amber-700",
  write_off: "bg-rose-50 text-rose-700",
  edit_approve: "bg-amber-50 text-amber-700",
};

function entityHref(entity: string, entityId: string): string | null {
  if (entity === "request") return `/manage/requests/${entityId}`;
  return null;
}

interface SP {
  entity?: string;
  userId?: string;
  from?: string;
  to?: string;
  page?: string;
}

export default async function Page({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const sp = await searchParams;

  const requestedPage = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const filter = {
    entity: sp.entity || undefined,
    userId: sp.userId || undefined,
    from: sp.from ? new Date(sp.from) : undefined,
    to: sp.to ? new Date(sp.to + "T23:59:59") : undefined,
  };

  const [total, listRaw, users] = await Promise.all([
    countAuditLogs(user, filter),
    listAuditLogs(user, { ...filter, limit: PAGE_SIZE, offset: (requestedPage - 1) * PAGE_SIZE }),
    prisma.user.findMany({ select: { id: true, fullName: true }, orderBy: { fullName: "asc" } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const list = requestedPage > totalPages
    ? await listAuditLogs(user, { ...filter, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE })
    : listRaw;

  const start = (page - 1) * PAGE_SIZE;
  const end = Math.min(start + PAGE_SIZE, total);
  const hasFilter = !!(sp.entity || sp.userId || sp.from || sp.to);

  function pageHref(targetPage: number): string {
    const params = new URLSearchParams();
    if (sp.entity) params.set("entity", sp.entity);
    if (sp.userId) params.set("userId", sp.userId);
    if (sp.from) params.set("from", sp.from);
    if (sp.to) params.set("to", sp.to);
    if (targetPage > 1) params.set("page", String(targetPage));
    const qs = params.toString();
    return qs ? `/manage/audit-logs?${qs}` : "/manage/audit-logs";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit log"
        subtitle={
          hasFilter
            ? `พบ ${total.toLocaleString("th-TH")} รายการตามเงื่อนไข`
            : `ประวัติทุกการเปลี่ยนแปลงในระบบ · ทั้งหมด ${total.toLocaleString("th-TH")} รายการ`
        }
      />

      {/* Filter form */}
      <Card>
        <form action="/manage/audit-logs" method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="block">
            <span className="text-xs font-medium text-slate-600">หมวดหมู่</span>
            <select
              name="entity"
              defaultValue={sp.entity ?? ""}
              className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="">ทั้งหมด</option>
              {ENTITIES.map((e) => (
                <option key={e} value={e}>{ENTITY_LABEL[e] ?? e}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">ผู้ใช้</span>
            <select
              name="userId"
              defaultValue={sp.userId ?? ""}
              className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="">ทั้งหมด</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.fullName}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">จาก</span>
            <input
              type="date"
              name="from"
              defaultValue={sp.from ?? ""}
              className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">ถึง</span>
            <input
              type="date"
              name="to"
              defaultValue={sp.to ?? ""}
              className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
            />
          </label>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="h-9 flex-1 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
            >
              กรอง
            </button>
            {hasFilter && (
              <Link
                href="/manage/audit-logs"
                className="flex h-9 items-center rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                ล้าง
              </Link>
            )}
          </div>
        </form>
      </Card>

      {total === 0 ? (
        <Card><EmptyState title={hasFilter ? "ไม่มีข้อมูลตามเงื่อนไข" : "ยังไม่มีข้อมูล"} /></Card>
      ) : (
        <>
          <div className="space-y-2">
            {list.map((l) => {
              const href = entityHref(l.entity, l.entityId);
              const hasPayload = l.before != null || l.after != null;
              return (
                <article key={l.id} className="rounded-xl border border-border bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{l.user?.fullName ?? "— (ลบแล้ว)"}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{l.createdAt.toLocaleString("th-TH")}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                        {ENTITY_LABEL[l.entity] ?? l.entity}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          ACTION_TONE[l.action] ?? "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {ACTION_LABEL[l.action] ?? l.action}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                    <span>
                      ID:{" "}
                      {href ? (
                        <Link href={href} className="font-mono text-brand-700 hover:underline">
                          {l.entityId.slice(0, 10)}…
                        </Link>
                      ) : (
                        <span className="font-mono">{l.entityId.slice(0, 10)}…</span>
                      )}
                    </span>
                    {l.ipAddress && <span>IP: {l.ipAddress}</span>}
                  </div>

                  {hasPayload && (
                    <details className="mt-3 rounded-lg bg-slate-50 px-3 py-2">
                      <summary className="cursor-pointer text-xs font-medium text-brand-700 hover:text-brand-900">
                        ดูค่าก่อน/หลัง
                      </summary>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">ก่อน</p>
                          <pre className="mt-1 max-h-64 overflow-auto rounded border border-slate-200 bg-white p-2 text-[10px] text-slate-700">
                            {l.before ? JSON.stringify(l.before, null, 2) : "—"}
                          </pre>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">หลัง</p>
                          <pre className="mt-1 max-h-64 overflow-auto rounded border border-slate-200 bg-white p-2 text-[10px] text-slate-700">
                            {l.after ? JSON.stringify(l.after, null, 2) : "—"}
                          </pre>
                        </div>
                      </div>
                    </details>
                  )}
                </article>
              );
            })}
          </div>

          {/* Pagination */}
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
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
        </>
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
