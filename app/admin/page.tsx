import { getDashboardSummary, getOutstandingByDepartment } from "@/lib/services/dashboard";
import { getWarehouseConditionSummary } from "@/lib/services/warehouse";
import { requireUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { WarehouseOpsPanel } from "./warehouse-ops-panel";

const TYPE_LABEL: Record<string, string> = {
  RECEIVE_NEW: "รับเข้าใหม่",
  ISSUE_INTERNAL: "เบิกออก",
  RETURN_INTERNAL: "คืนเข้า",
  SHIP_CUSTOMER: "ส่งลูกค้า",
  RETURN_CUSTOMER: "รับคืนจากลูกค้า",
  SEND_REPAIR: "ส่งซ่อม",
  RECEIVE_REPAIR: "รับคืนจากซ่อม",
  WRITE_OFF: "ตัดจำหน่าย",
  ADJUSTMENT: "ปรับยอด",
};

const CONDITION_LABEL: Record<string, string> = {
  USABLE: "ดี",
  IN_REPAIR: "รอซ่อม",
  UNUSABLE: "เสีย",
};

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";

  const [s, warehouse, outstanding, recentPending, recentAudit, userStats, palletTypeCount, deptCount] =
    await Promise.all([
      getDashboardSummary(),
      getWarehouseConditionSummary(),
      getOutstandingByDepartment(),
      prisma.request.findMany({
        where: { status: "PENDING" },
        include: {
          requester: { select: { fullName: true } },
          items: { include: { palletType: { select: { name: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { user: { select: { fullName: true } } },
      }),
      prisma.user.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.palletType.count({ where: { active: true } }),
      prisma.department.count({ where: { active: true } }),
    ]);

  const activeUsers = userStats.find((u) => u.status === "ACTIVE")?._count._all ?? 0;
  const pendingUsers = userStats.find((u) => u.status === "PENDING")?._count._all ?? 0;

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">ภาพรวมสถานะพาเลทและคำขอในระบบ</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/requests?status=PENDING"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-white px-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            คำขอรออนุมัติ ({s.pendingRequests})
          </Link>
          <Link
            href="/admin/requests"
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-600 px-3.5 text-sm font-medium text-white shadow-sm shadow-brand-600/30 hover:bg-brand-700"
          >
            ดูคำขอทั้งหมด
          </Link>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="พาเลทในคลัง (ดี)" value={s.warehouseUsable} tone="brand" />
        <StatCard label="รอซ่อม (ในคลัง)" value={s.inRepair} tone="warning" />
        <StatCard label="ค้างนอกคลัง" value={s.outstandingOutside} tone="warning" />
        <StatCard label="ตัดจำหน่าย (30 วัน)" value={s.writeOffLast30d} tone="rose" />
        <StatCard label="คำขอรออนุมัติ" value={s.pendingRequests} tone="slate" />
        <StatCard label="คำขออนุมัติแล้ว" value={s.approvedRequests} tone="brand" />
        <StatCard
          label="ผู้ใช้งาน"
          value={activeUsers}
          tone="slate"
          hint={pendingUsers > 0 ? `+ ${pendingUsers} รอยืนยัน` : undefined}
        />
        <StatCard
          label="ชนิดพาเลท · แผนก"
          value={`${palletTypeCount} · ${deptCount}`}
          tone="slate"
        />
      </section>

      <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">สต็อกในคลังพาเลท (WH-PL)</h2>
            <p className="mt-1 text-sm text-slate-500">
              จำนวนคงเหลือแยกตามสภาพ
              {isAdmin && <> · สามารถซ่อมหรือตัดจำหน่ายได้ที่นี่</>}
            </p>
          </div>
          {!isAdmin && (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
              Admin เท่านั้นที่จัดการได้
            </span>
          )}
        </div>
        <div className="mt-5">
          {isAdmin ? (
            <WarehouseOpsPanel rows={warehouse} />
          ) : (
            <ReadOnlyWarehouseTable rows={warehouse} />
          )}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">คำขอรออนุมัติล่าสุด</h2>
              <p className="mt-1 text-sm text-slate-500">
                {recentPending.length === 0
                  ? "ยังไม่มีคำขอรออนุมัติ"
                  : `${recentPending.length} รายการ`}
              </p>
            </div>
            <Link
              href="/admin/requests?status=PENDING"
              className="text-sm font-medium text-brand-700 hover:text-brand-900"
            >
              ดูทั้งหมด →
            </Link>
          </div>

          {recentPending.length === 0 ? (
            <EmptyBox />
          ) : (
            <ul className="mt-5 divide-y divide-slate-100">
              {recentPending.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/requests/${r.id}`}
                      className="font-medium text-slate-900 hover:text-brand-700"
                    >
                      {r.docNo}
                    </Link>
                    <p className="mt-0.5 text-xs text-slate-500 truncate">
                      {TYPE_LABEL[r.type] ?? r.type} · {r.requester.fullName} · {r.items.length} รายการ
                    </p>
                  </div>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                    PENDING
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">กิจกรรมล่าสุด</h2>
          <p className="mt-1 text-sm text-slate-500">{recentAudit.length} รายการล่าสุด</p>
          <ul className="mt-5 space-y-3">
            {recentAudit.length === 0 && (
              <li className="text-xs text-slate-400">ไม่มีกิจกรรม</li>
            )}
            {recentAudit.map((a) => (
              <li key={a.id} className="flex items-start gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-800">
                    <span className="font-medium">{a.user?.fullName ?? "-"}</span>{" "}
                    <span className="text-slate-500">
                      {a.action} {a.entity}
                    </span>
                  </p>
                  <p className="text-[11px] text-slate-400">{a.createdAt.toLocaleString("th-TH")}</p>
                </div>
              </li>
            ))}
          </ul>
          <Link
            href="/admin/audit-logs"
            className="mt-4 inline-flex text-xs font-medium text-brand-700 hover:text-brand-900"
          >
            ดู Audit log ทั้งหมด →
          </Link>
        </div>
      </section>

      {outstanding.some((d) => d.rows.length > 0) && (
        <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">พาเลทค้างตามแผนก</h2>
          <p className="mt-1 text-sm text-slate-500">พาเลทที่ยังอยู่นอกคลัง แยกตามแผนก</p>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {outstanding
              .filter((d) => d.rows.length > 0)
              .map((d) => (
                <div key={d.department.id} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-mono text-[11px] text-slate-500">{d.department.code}</p>
                      <p className="text-sm font-semibold text-slate-900">{d.department.name}</p>
                    </div>
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-900">
                      {d.total}
                    </span>
                  </div>
                  <ul className="mt-3 space-y-1 text-xs">
                    {d.rows.map((row, i) => (
                      <li key={i} className="flex items-center justify-between gap-2 text-slate-600">
                        <span className="min-w-0 truncate">
                          {row.palletType?.name ?? row.palletTypeId}{" "}
                          <span className="text-slate-400">· {CONDITION_LABEL[row.condition] ?? row.condition}</span>
                        </span>
                        <span className="shrink-0 font-mono text-slate-900">{row.quantity}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        </section>
      )}

      {s.pendingByType.length > 0 && (
        <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">คำขอ PENDING แยกตามประเภท</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {s.pendingByType.map((row) => (
              <span
                key={row.type}
                className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700"
              >
                {TYPE_LABEL[row.type] ?? row.type}
                <span className="rounded-full bg-white px-1.5 text-xs font-semibold text-slate-900">
                  {row.count}
                </span>
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ReadOnlyWarehouseTable({
  rows,
}: {
  rows: { id: string; code: string; name: string; usable: number; inRepair: number; unusable: number }[];
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-sm text-slate-500">
        ยังไม่มีข้อมูลพาเลทในคลัง
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <th className="pb-2">รหัส</th>
            <th className="pb-2">ชนิดพาเลท</th>
            <th className="pb-2 text-right">ดี</th>
            <th className="pb-2 text-right">รอซ่อม</th>
            <th className="pb-2 text-right">เสีย</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="py-3 font-mono text-xs text-slate-500">{r.code}</td>
              <td className="py-3 font-medium text-slate-900">{r.name}</td>
              <td className="py-3 text-right font-mono text-emerald-700">{r.usable}</td>
              <td className="py-3 text-right font-mono text-amber-700">{r.inRepair}</td>
              <td className="py-3 text-right font-mono text-rose-700">{r.unusable}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: number | string;
  tone: "brand" | "warning" | "rose" | "slate";
  hint?: string;
}) {
  const tones: Record<string, string> = {
    brand: "bg-brand-100 text-brand-700",
    warning: "bg-amber-100 text-amber-700",
    rose: "bg-rose-100 text-rose-700",
    slate: "bg-slate-100 text-slate-700",
  };
  return (
    <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-slate-600">{label}</p>
        <span className={`h-6 w-6 rounded-full ${tones[tone]}`} />
      </div>
      <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
        {typeof value === "number" ? value.toLocaleString("th-TH") : value}
      </p>
      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}

function EmptyBox() {
  return (
    <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-10 text-center">
      <p className="text-sm font-medium text-slate-700">ยังไม่มีคำขอในระบบ</p>
      <p className="mt-1 text-xs text-slate-500">รายการจะปรากฏเมื่อผู้ใช้เริ่มสร้างคำขอ</p>
    </div>
  );
}
