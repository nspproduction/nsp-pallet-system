import {
  getDashboardSummary,
  getWarehouseMovements,
  getIssueReturnByDepartment,
  getIssueReturnByPerson,
  getRepairQuality,
  getReturnBySource,
  getTrend,
  type DashboardFilter,
  type TrendGranularity,
  type ReturnSourceKey,
} from "@/lib/services/dashboard";
import { getWarehouseConditionSummary } from "@/lib/services/warehouse";
import { requireUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { WarehouseOpsPanel } from "./warehouse-ops-panel";
import { DashboardFilters } from "./dashboard-filters";
import { TrendChart } from "./trend-chart";
import { MovementsTable } from "./movements-table";

const TYPE_LABEL: Record<string, string> = {
  ISSUE: "เบิกออก",
  RETURN: "คืนเข้า",
  WRITE_OFF: "ตัดจำหน่าย",
  ADJUSTMENT: "ปรับยอด",
};

const RETURN_SOURCE_LABEL: Record<ReturnSourceKey, string> = {
  INTERNAL: "ใช้ภายใน",
  CUSTOMER: "ลูกค้า",
};

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string>>;
}

export default async function AdminDashboard({ searchParams }: PageProps) {
  await requireUser();

  const sp = await searchParams;

  const filter: DashboardFilter = {
    from: sp.from ? new Date(sp.from) : undefined,
    to: sp.to ? new Date(sp.to) : undefined,
    departmentId: sp.departmentId || undefined,
    palletTypeId: sp.palletTypeId || undefined,
  };

  const granularity: TrendGranularity =
    sp.granularity === "week" || sp.granularity === "month"
      ? sp.granularity
      : "day";

  const [
    s,
    warehouse,
    movements,
    deptStats,
    personStats,
    repairStats,
    returnBySource,
    trend,
    recentPending,
    recentAudit,
    userStats,
    palletTypeCount,
    deptCount,
    departments,
    palletTypes,
  ] = await Promise.all([
    getDashboardSummary(),
    getWarehouseConditionSummary(),
    getWarehouseMovements(filter),
    getIssueReturnByDepartment(filter),
    getIssueReturnByPerson(filter),
    getRepairQuality(filter),
    getReturnBySource(filter),
    getTrend(granularity, filter),
    prisma.request.findMany({
      where: { status: { in: ["PENDING_DEPT", "PENDING_WAREHOUSE"] } },
      include: {
        requester: { select: { fullName: true } },
        items: { include: { palletType: { select: { name: true } } } },
      },
      orderBy: [{ createdAt: "desc" }],
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
    prisma.department.findMany({
      where: { active: true, isWarehouse: false },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.palletType.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const activeUsers = userStats.find((u) => u.status === "ACTIVE")?._count._all ?? 0;
  const pendingUsers = userStats.find((u) => u.status === "PENDING")?._count._all ?? 0;

  const hasDateFilter = !!filter.from || !!filter.to;
  const trendCapLabel = hasDateFilter
    ? "ตามช่วงเวลาที่เลือก"
    : granularity === "day"
      ? "30 วันล่าสุด"
      : granularity === "week"
        ? "26 สัปดาห์ล่าสุด"
        : "24 เดือนล่าสุด";

  return (
    <div className="space-y-8">
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">ภาพรวมสถานะพาเลทและคำขอในระบบ</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/manage/requests?status=PENDING_DEPT"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-white px-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            คำขอรออนุมัติ ({s.pendingRequests})
          </Link>
          <Link
            href="/manage/requests"
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-600 px-3.5 text-sm font-medium text-white shadow-sm shadow-brand-600/30 hover:bg-brand-700"
          >
            ดูคำขอทั้งหมด
          </Link>
        </div>
      </header>

      {/* ─── 1. KPI cards ────────────────────────────────────────────────── */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="พาเลทในคลัง (ดี)" value={s.warehouseUsable} tone="brand" />
        <StatCard label="รอซ่อม (ในคลัง)" value={s.inRepair} tone="warning" />
        <StatCard label="ตัดจำหน่าย (30 วัน)" value={s.writeOffLast30d} tone="rose" />
        <StatCard label="คำขอรออนุมัติ" value={s.pendingRequests} tone="slate" />
        <StatCard label="คำขออนุมัติแล้ว" value={s.approvedRequests} tone="brand" />
        <StatCard
          label="ผู้ใช้งาน"
          value={activeUsers}
          tone="slate"
          hint={pendingUsers > 0 ? `+ ${pendingUsers} รอยืนยัน` : undefined}
        />
        <StatCard label="ชนิดพาเลท" value={palletTypeCount} tone="slate" />
        <StatCard label="แผนก" value={deptCount} tone="slate" />
      </section>

      {/* ─── 2. Warehouse stock ──────────────────────────────────────────── */}
      <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">ยอดในคลัง แยกตามสภาพ</h2>
            <p className="mt-1 text-sm text-slate-500">จำนวนคงเหลือปัจจุบัน · จัดการได้ที่นี่</p>
          </div>
        </div>
        <div className="mt-5">
          <WarehouseOpsPanel rows={warehouse} />
        </div>
      </section>

      {/* ─── 3. Movement history ─────────────────────────────────────────── */}
      <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">การเคลื่อนไหวของคลัง</h2>
        <p className="mt-1 text-sm text-slate-500">รายการตามช่วงเวลาที่เลือก · ใหม่สุดก่อน</p>
        <div className="mt-5">
          <MovementsTable rows={movements} />
        </div>
      </section>

      {/* ─── 4. Trend chart ──────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">แนวโน้ม</h2>
            <p className="mt-1 text-sm text-slate-500">เบิกออก / คืนเข้า · {trendCapLabel}</p>
          </div>
          <GranularityLinks current={granularity} sp={sp} />
        </div>
        <div className="mt-6">
          <TrendChart data={trend} />
        </div>
      </section>

      {/* ─── 5. Per-department ───────────────────────────────────────────── */}
      <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">รายแผนก</h2>
        <p className="mt-1 text-sm text-slate-500">ยอดเบิก/คืน ตามช่วงเวลาที่เลือก</p>
        <div className="mt-5 overflow-x-auto">
          {deptStats.length === 0 ? (
            <EmptyBox />
          ) : (
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="pb-2 pr-3">แผนก</th>
                  <th className="pb-2 pr-3 text-right">เบิก</th>
                  <th className="pb-2 pr-3 text-right">คืน-ดี</th>
                  <th className="pb-2 pr-3 text-right">คืน-รอซ่อม</th>
                  <th className="pb-2 text-right">คืน-เสีย</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {deptStats.map((r) => (
                  <tr key={r.departmentId} className="hover:bg-slate-50/50">
                    <td className="py-2 pr-3">
                      <span className="text-slate-800">{r.departmentName}</span>
                    </td>
                    <Num v={r.issueQty} />
                    <Num v={r.returnGoodQty} />
                    <Num v={r.returnRepairQty} warn />
                    <Num v={r.returnDamagedQty} neg />
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* ─── 5b. Return by source (คืนตามที่มา) ───────────────────────────── */}
      <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">คืนตามที่มา</h2>
        <p className="mt-1 text-sm text-slate-500">
          แยกตามแหล่งที่มาของพาเลทที่คืนเข้าคลัง (เฉพาะคำขอ RETURN · แผนกที่ไม่ตั้งค่า &quot;ระบุที่มา&quot; จะถือว่าเป็นใช้ภายในโดยอัตโนมัติ)
        </p>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="pb-2 pr-3">ที่มา</th>
                <th className="pb-2 pr-3 text-right">คืน-ดี</th>
                <th className="pb-2 pr-3 text-right">คืน-รอซ่อม</th>
                <th className="pb-2 text-right">คืน-เสีย</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {returnBySource.map((r) => (
                <tr key={r.source} className="hover:bg-slate-50/50">
                  <td className="py-2 pr-3 text-slate-800">{RETURN_SOURCE_LABEL[r.source]}</td>
                  <Num v={r.returnGood} />
                  <Num v={r.returnRepair} warn />
                  <Num v={r.returnDamaged} neg />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ─── 6. Per-person ───────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">รายคน</h2>
        <p className="mt-1 text-sm text-slate-500">สรุปจำนวนคำขอและพาเลทต่อผู้ใช้</p>
        <div className="mt-5 overflow-x-auto">
          {personStats.length === 0 ? (
            <EmptyBox />
          ) : (
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="pb-2 pr-3">ชื่อ</th>
                  <th className="pb-2 pr-3">แผนก</th>
                  <th className="pb-2 pr-3 text-right">คำขอ</th>
                  <th className="pb-2 pr-3 text-right">เบิก</th>
                  <th className="pb-2 text-right">คืน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {personStats.map((r) => (
                  <tr key={r.userId} className="hover:bg-slate-50/50">
                    <td className="py-2 pr-3 font-medium text-slate-800">{r.fullName}</td>
                    <td className="py-2 pr-3 text-slate-500">{r.departmentName}</td>
                    <Num v={r.requestCount} />
                    <Num v={r.issueQty} />
                    <Num v={r.returnQty} />
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* ─── 7. Repair quality ───────────────────────────────────────────── */}
      <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">คุณภาพการซ่อม</h2>
        <p className="mt-1 text-sm text-slate-500">อัตราซ่อมสำเร็จต่อประเภทพาเลท</p>
        <div className="mt-5 overflow-x-auto">
          {repairStats.length === 0 ? (
            <EmptyBox />
          ) : (
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="pb-2 pr-3">ประเภทพาเลท</th>
                  <th className="pb-2 pr-3 text-right">ส่งซ่อม</th>
                  <th className="pb-2 pr-3 text-right">ซ่อม-ดี</th>
                  <th className="pb-2 pr-3 text-right">ซ่อม-เสีย</th>
                  <th className="pb-2 text-right">อัตราสำเร็จ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {repairStats.map((r) => (
                  <tr key={r.palletTypeId} className="hover:bg-slate-50/50">
                    <td className="py-2 pr-3 text-slate-800">{r.palletTypeName}</td>
                    <Num v={r.totalRepaired} />
                    <Num v={r.repairedGood} />
                    <Num v={r.repairedDamaged} neg />
                    <td className="py-2 text-right font-mono text-xs text-slate-700">
                      {(r.repairRate * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* ─── 8. Recent pending requests ──────────────────────────────────── */}
      <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">คำขออนุมัติล่าสุด</h2>
            <p className="mt-1 text-sm text-slate-500">
              {recentPending.length === 0 ? "ยังไม่มีคำขอรออนุมัติ" : `${recentPending.length} รายการ`}
            </p>
          </div>
          <Link
            href="/manage/requests"
            className="text-sm font-medium text-brand-700 hover:text-brand-900"
          >
            ดูทั้งหมด →
          </Link>
        </div>
        {recentPending.length > 0 && (
          <ul className="mt-5 divide-y divide-slate-100">
            {recentPending.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <Link
                    href={`/manage/requests/${r.id}`}
                    className="font-medium text-slate-900 hover:text-brand-700"
                  >
                    {r.docNo}
                  </Link>
                  <p className="mt-0.5 text-xs text-slate-500 truncate">
                    {TYPE_LABEL[r.type] ?? r.type} · {r.requester.fullName} · {r.items.length} รายการ
                  </p>
                </div>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                  {r.status === "PENDING_WAREHOUSE" ? "รอคลัง" : "รอแผนก"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ─── 9. Recent audit log ─────────────────────────────────────────── */}
      <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">กิจกรรมล่าสุด</h2>
            <p className="mt-1 text-sm text-slate-500">{recentAudit.length} รายการล่าสุด</p>
          </div>
          <Link
            href="/manage/audit-logs"
            className="text-sm font-medium text-brand-700 hover:text-brand-900"
          >
            ดูทั้งหมด →
          </Link>
        </div>
        {recentAudit.length === 0 ? (
          <p className="mt-5 text-xs text-slate-400">ไม่มีกิจกรรม</p>
        ) : (
          <ul className="mt-5 space-y-3">
            {recentAudit.map((a) => (
              <li key={a.id} className="flex items-start gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-800">
                    <span className="font-medium">{a.user?.fullName ?? "-"}</span>{" "}
                    <span className="text-slate-500">{a.action} {a.entity}</span>
                  </p>
                  <p className="text-[11px] text-slate-400">{a.createdAt.toLocaleString("th-TH")}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ─── 10. Filter bar ──────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">ตัวกรองข้อมูล</h2>
            <p className="mt-1 text-sm text-slate-500">
              ส่งผลต่อ: การเคลื่อนไหว · แนวโน้ม · รายแผนก · รายคน · คุณภาพการซ่อม
            </p>
          </div>
        </div>
        <div className="mt-4">
          <DashboardFilters departments={departments} palletTypes={palletTypes} />
        </div>
      </section>
    </div>
  );
}

// ─── Small components ─────────────────────────────────────────────────────────

function Num({ v, neg, warn }: { v: number; neg?: boolean; warn?: boolean }) {
  if (v === 0) return <td className="py-2 pr-3 text-right font-mono text-xs text-slate-300">—</td>;
  const cls = neg
    ? "text-rose-600"
    : warn
      ? "text-amber-600"
      : "text-slate-800";
  return <td className={`py-2 pr-3 text-right font-mono text-xs ${cls}`}>{v.toLocaleString("th-TH")}</td>;
}

function GranularityLinks({
  current,
  sp,
}: {
  current: TrendGranularity;
  sp: Record<string, string>;
}) {
  const items: { label: string; value: TrendGranularity }[] = [
    { label: "รายวัน", value: "day" },
    { label: "รายสัปดาห์", value: "week" },
    { label: "รายเดือน", value: "month" },
  ];
  return (
    <div className="flex gap-1 rounded-lg border border-border bg-slate-50 p-1">
      {items.map((item) => {
        const params = new URLSearchParams(sp);
        params.set("granularity", item.value);
        return (
          <a
            key={item.value}
            href={`?${params.toString()}`}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              current === item.value
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {item.label}
          </a>
        );
      })}
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
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-10 text-center">
      <p className="text-sm font-medium text-slate-700">ไม่มีข้อมูล</p>
      <p className="mt-1 text-xs text-slate-500">ปรับช่วงวันที่หรือตัวกรอง</p>
    </div>
  );
}
