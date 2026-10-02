"use client";

// Library
import { useEffect, useState } from "react";

// Components
import { LiffTopBar, LiffEmpty } from "../_shared";
import { Skeleton } from "@/app/_components/ui";

// Lib
import { safeFetchJson } from "../_fetch";

interface Row {
  palletTypeId: string;
  condition: string;
  departmentId: string;
  quantity: number;
  palletType: { id: string; code: string; name: string } | null;
  department: { id: string; code: string; name: string } | null;
}

const CONDITION_LABEL: Record<string, string> = {
  USABLE: "ดี",
  IN_REPAIR: "ส่งซ่อม",
  UNUSABLE: "เสีย",
};

export default function Page() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    safeFetchJson<Row[]>("/api/balances").then(({ data, error }) => {
      setError(error);
      setRows(Array.isArray(data) ? data : []);
    });
  }, []);

  if (rows === null) {
    return (
      <div>
        <LiffTopBar title="ยอดคงเหลือ" />
        <div className="space-y-4 p-4">
          <div className="flex gap-2 overflow-x-auto">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-20 shrink-0 rounded-full" />
            ))}
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border bg-white p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-2.5 w-16" />
                  <Skeleton className="h-4 w-36" />
                </div>
                <Skeleton className="h-5 w-10 rounded-full" />
              </div>
              <ul className="mt-3 space-y-3">
                {Array.from({ length: 2 }).map((_, j) => (
                  <li key={j} className="flex items-center justify-between">
                    <div className="space-y-1.5">
                      <Skeleton className="h-3 w-28" />
                      <Skeleton className="h-2.5 w-16" />
                    </div>
                    <Skeleton className="h-3 w-8" />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const grouped = new Map<string, Row[]>();
  for (const r of rows) {
    if (deptFilter !== "all" && r.departmentId !== deptFilter) continue;
    const k = r.department?.id ?? "unknown";
    grouped.set(k, [...(grouped.get(k) ?? []), r]);
  }

  const deptChips = Array.from(
    new Map(
      rows
        .filter((r) => r.department)
        .map((r) => [r.department!.id, r.department!]),
    ).values(),
  ).sort((a, b) => a.code.localeCompare(b.code));
  const FILTERS = [{ v: "all", l: "ทั้งหมด" }, ...deptChips.map((d) => ({ v: d.id, l: d.name }))];

  return (
    <div>
      <LiffTopBar title="ยอดคงเหลือ" />
      <div className="p-4">
        {error && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            {error}
          </div>
        )}

        <div className="mb-4 flex gap-2 overflow-x-auto">
          {FILTERS.map((t) => (
            <button
              key={t.v}
              onClick={() => setDeptFilter(t.v)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs ${
                deptFilter === t.v ? "bg-brand-600 text-white" : "border border-slate-200 bg-white text-slate-700"
              }`}
            >
              {t.l}
            </button>
          ))}
        </div>

        {grouped.size === 0 ? (
          <LiffEmpty title="ไม่มีข้อมูล" />
        ) : (
          <div className="space-y-4">
            {Array.from(grouped.entries()).map(([deptId, list]) => (
              <div key={deptId} className="rounded-2xl border border-border bg-white p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] text-slate-400">{list[0]?.department?.code}</p>
                    <p className="text-sm font-semibold text-slate-900">{list[0]?.department?.name ?? "-"}</p>
                  </div>
                  <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700">
                    {list.reduce((s, r) => s + r.quantity, 0)}
                  </span>
                </div>
                <ul className="mt-3 divide-y divide-slate-100">
                  {list.map((r, i) => (
                    <li key={i} className="flex items-center justify-between py-2">
                      <div className="min-w-0">
                        <p className="text-sm text-slate-800">{r.palletType?.name ?? "-"}</p>
                        <p className="text-[10px] text-slate-500">{CONDITION_LABEL[r.condition] ?? r.condition}</p>
                      </div>
                      <span className="font-mono text-sm text-slate-900">{r.quantity}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
