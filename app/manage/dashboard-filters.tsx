"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useTransition } from "react";

interface Option {
  id: string;
  name: string;
}

export function DashboardFilters({
  departments,
  palletTypes,
}: {
  departments: Option[];
  palletTypes: Option[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [, startTransition] = useTransition();

  function update(key: string, value: string) {
    const params = new URLSearchParams(sp.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    startTransition(() => router.replace(`${pathname}?${params.toString()}`));
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-slate-600">จาก</span>
        <input
          type="date"
          defaultValue={sp.get("from") ?? ""}
          onChange={(e) => update("from", e.target.value)}
          className="h-9 rounded-lg border border-border bg-white px-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-slate-600">ถึง</span>
        <input
          type="date"
          defaultValue={sp.get("to") ?? ""}
          onChange={(e) => update("to", e.target.value)}
          className="h-9 rounded-lg border border-border bg-white px-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-slate-600">แผนก</span>
        <select
          defaultValue={sp.get("departmentId") ?? ""}
          onChange={(e) => update("departmentId", e.target.value)}
          className="h-9 rounded-lg border border-border bg-white px-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">ทุกแผนก</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-slate-600">ประเภทพาเลท</span>
        <select
          defaultValue={sp.get("palletTypeId") ?? ""}
          onChange={(e) => update("palletTypeId", e.target.value)}
          className="h-9 rounded-lg border border-border bg-white px-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">ทุกประเภท</option>
          {palletTypes.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </label>

      <ExportButton sp={sp} />
    </div>
  );
}

function ExportButton({ sp }: { sp: URLSearchParams }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/dashboard/export?${sp.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErr(data.error ?? "Export ไม่สำเร็จ");
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") ?? "";
      const match = cd.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? `pallet-report-${new Date().toISOString().slice(0, 10)}.xlsx`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setErr("Export ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-white px-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? (
          <>
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
              <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
            </svg>
            <span>กำลังเตรียมไฟล์...</span>
          </>
        ) : (
          <>
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-4m0 0V8m0 4H8m4 0h4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V6a2 2 0 012-2h3l2 2h6a2 2 0 012 2v2" />
            </svg>
            <span>Export Excel</span>
          </>
        )}
      </button>
      {err && <p className="mt-1 text-xs text-rose-600">{err}</p>}
    </div>
  );
}
