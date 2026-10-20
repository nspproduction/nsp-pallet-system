import { requireUser } from "@/lib/auth/current-user";
import { getDashboardSummary } from "@/lib/services/dashboard";
import { getWarehouseConditionSummary } from "@/lib/services/warehouse";
import { LiffTopBar } from "../_shared";

export const dynamic = "force-dynamic";

export default async function AppDashboardPage() {
  await requireUser();

  const [s, warehouse] = await Promise.all([
    getDashboardSummary(),
    getWarehouseConditionSummary(),
  ]);

  return (
    <div className="flex flex-col pb-8">
      <LiffTopBar title="ภาพรวมระบบ" backHref="/app" />

      {/* ─── KPI ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 px-4 pt-4">
        <KpiCard label="พาเลทดีในคลัง" value={s.warehouseUsable} tone="brand" />
        <KpiCard label="รอซ่อม" value={s.inRepair} tone="warning" />
        <KpiCard label="ค้างนอกคลัง" value={s.outstandingOutside} tone="warning" />
        <KpiCard label="ตัดจำหน่าย (30 วัน)" value={s.writeOffLast30d} tone="rose" />
      </div>

      {/* ─── ยอดในคลัง ────────────────────────────────────────── */}
      <section className="mx-4 mt-4 rounded-2xl border border-border bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-slate-900">ยอดในคลัง แยกตามสภาพ</p>
        {warehouse.length === 0 ? (
          <p className="mt-3 text-xs text-slate-400">ยังไม่มีข้อมูล</p>
        ) : (
          <>
            <div className="mt-3 divide-y divide-slate-100">
              {warehouse.map((r) => (
                <div key={r.id} className="flex items-center justify-between py-2.5">
                  <span className="text-sm font-medium text-slate-800">{r.name}</span>
                  <div className="flex gap-4 font-mono text-xs">
                    <span className="text-emerald-700">{r.usable}</span>
                    <span className="text-amber-700">{r.inRepair}</span>
                    <span className="text-rose-700">{r.unusable}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-end gap-3 text-[10px]">
              <span className="text-emerald-600">■ ดี</span>
              <span className="text-amber-600">■ รอซ่อม</span>
              <span className="text-rose-600">■ เสีย</span>
            </div>
          </>
        )}
      </section>

    </div>
  );
}

function KpiCard({ label, value, tone }: { label: string; value: number; tone: "brand" | "warning" | "rose" }) {
  const styles = {
    brand: "bg-brand-50 text-brand-700",
    warning: "bg-amber-50 text-amber-800",
    rose: "bg-rose-50 text-rose-700"
  };
  return (
    <div className={`rounded-2xl p-4 ${styles[tone]}`}>
      <p className="text-[11px] font-medium leading-tight opacity-80">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value.toLocaleString("th-TH")}</p>
    </div>
  );
}
