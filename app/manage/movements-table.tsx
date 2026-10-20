"use client";

import { useMemo, useState } from "react";
import type { MovementRow } from "@/lib/services/dashboard";

const PAGE_SIZE = 20;

export function MovementsTable({ rows }: { rows: MovementRow[] }) {
  const [page, setPage] = useState(1);
  // Reset to page 1 whenever the data changes (e.g. user changes filter).
  // Uses the "adjust state while rendering" pattern recommended by React docs.
  const [prevRows, setPrevRows] = useState(rows);
  if (rows !== prevRows) {
    setPrevRows(rows);
    setPage(1);
  }

  const sorted = useMemo(() => [...rows].sort((a, b) => b.date.localeCompare(a.date)), [rows]);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const start = (current - 1) * PAGE_SIZE;
  const slice = sorted.slice(start, start + PAGE_SIZE);

  if (sorted.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-10 text-center">
        <p className="text-sm font-medium text-slate-700">ไม่มีข้อมูล</p>
        <p className="mt-1 text-xs text-slate-500">ปรับช่วงวันที่หรือตัวกรอง</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="text-[10px] font-semibold uppercase tracking-wider">
              <th rowSpan={2} className="border-b border-slate-200 pb-2 pr-3 text-left align-bottom text-slate-500">
                วันที่
              </th>
              <th colSpan={4} className="border-b border-l-2 border-blue-200 bg-blue-50/60 py-1.5 text-center text-blue-700">
                จากคำขอ
              </th>
              <th colSpan={3} className="border-b border-l-2 border-amber-200 bg-amber-50/60 py-1.5 text-center text-amber-700">
                จากคลังพาเลท
              </th>
              <th className="border-b border-l-2 border-slate-300 bg-slate-100 py-1.5 text-center text-slate-700">
                ปรับยอด
              </th>
            </tr>
            <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <th className="border-l-2 border-blue-200 pb-2 pr-3 text-right">เบิกออก</th>
              <th className="pb-2 pr-3 text-right">คืน-ดี</th>
              <th className="pb-2 pr-3 text-right">คืน-รอซ่อม</th>
              <th className="pb-2 pr-3 text-right">คืน-เสีย</th>
              <th className="border-l-2 border-amber-200 pb-2 pr-3 text-right">ซ่อม-ดี</th>
              <th className="pb-2 pr-3 text-right">ซ่อม-เสีย</th>
              <th className="pb-2 pr-3 text-right">ตัด</th>
              <th className="border-l-2 border-slate-300 pb-2 pr-3 text-right">ปรับ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {slice.map((r) => (
              <tr key={r.date} className="hover:bg-slate-50/50">
                <td className="py-2 pr-3 font-mono text-xs text-slate-600">{r.date}</td>
                <Num v={r.issueOut} neg group="blue" />
                <Num v={r.returnGood} />
                <Num v={r.returnRepair} warn />
                <Num v={r.returnDamaged} neg />
                <Num v={r.repairGood} group="amber" />
                <Num v={r.repairDamaged} neg />
                <Num v={r.writeOff} neg />
                <Num v={r.adjustment} group="slate" />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">
          แสดง {(start + 1).toLocaleString("th-TH")}–
          {Math.min(start + PAGE_SIZE, sorted.length).toLocaleString("th-TH")} จาก{" "}
          {sorted.length.toLocaleString("th-TH")} รายการ
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={current === 1}
            onClick={() => setPage(current - 1)}
            className="h-8 rounded-lg border border-border bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ← ก่อนหน้า
          </button>
          <span className="text-xs font-medium text-slate-600">
            หน้า {current} / {totalPages}
          </span>
          <button
            type="button"
            disabled={current === totalPages}
            onClick={() => setPage(current + 1)}
            className="h-8 rounded-lg border border-border bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ถัดไป →
          </button>
        </div>
      </div>
    </>
  );
}

function Num({
  v,
  neg,
  warn,
  group
}: {
  v: number;
  neg?: boolean;
  warn?: boolean;
  group?: "blue" | "amber" | "slate";
}) {
  const border =
    group === "blue"
      ? "border-l-2 border-blue-200"
      : group === "amber"
        ? "border-l-2 border-amber-200"
        : group === "slate"
          ? "border-l-2 border-slate-300"
          : "";
  if (v === 0) return <td className={`py-2 pr-3 text-right font-mono text-xs text-slate-300 ${border}`}>—</td>;
  const cls = neg ? "text-rose-600" : warn ? "text-amber-600" : "text-slate-800";
  return <td className={`py-2 pr-3 text-right font-mono text-xs ${cls} ${border}`}>{v.toLocaleString("th-TH")}</td>;
}
