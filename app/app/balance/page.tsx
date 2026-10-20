"use client";

// Library
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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
  palletType: { id: string; name: string; active: boolean } | null;
  department: { id: string; name: string; isWarehouse: boolean } | null;
}

interface MeResponse {
  authenticated: boolean;
  user?: { id: string; roles: string[] };
}

const CONDITION_LABEL: Record<string, string> = {
  GOOD: "ดี",
  PENDING_REPAIR: "ส่งซ่อม",
  DAMAGED: "เสีย"
};

const CONDITION_COLOR: Record<string, string> = {
  GOOD: "text-emerald-700",
  PENDING_REPAIR: "text-amber-700",
  DAMAGED: "text-rose-700"
};

const CONDITION_ORDER = ["GOOD", "PENDING_REPAIR", "DAMAGED"];

export default function Page() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const [meRes, balRes] = await Promise.all([
        safeFetchJson<MeResponse>("/api/auth/me"),
        safeFetchJson<Row[]>("/api/balances")
      ]);
      setMe(meRes.data ?? null);
      setError(balRes.error);
      setRows(Array.isArray(balRes.data) ? balRes.data.filter((r) => r.department?.isWarehouse) : []);
    })();
  }, []);

  const roles = me?.user?.roles ?? [];
  const canManage = roles.some((r) => ["PALLET_MANAGER", "ADMIN"].includes(r));

  if (rows === null || me === null) {
    return (
      <div>
        <LiffTopBar title="ยอดคงเหลือในคลัง" />
        <div className="space-y-4 p-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border bg-white p-4">
              <div className="flex items-start justify-between">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-5 w-10 rounded-full" />
              </div>
              <ul className="mt-3 space-y-3">
                {Array.from({ length: 3 }).map((_, j) => (
                  <li key={j} className="flex items-center justify-between">
                    <Skeleton className="h-3 w-16" />
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

  if (!canManage) {
    return (
      <div>
        <LiffTopBar title="ยอดคงเหลือในคลัง" />
        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-rose-100 text-2xl text-rose-500">🚫</div>
          <p className="mt-4 text-sm font-semibold text-slate-800">บทบาทของคุณไม่สามารถเข้าถึงหน้านี้ได้</p>
          <p className="mt-1 max-w-xs text-xs text-slate-500">เฉพาะ Pallet Manager และ Admin เท่านั้น</p>
          <button
            onClick={() => router.push("/app")}
            className="mt-6 h-10 rounded-full bg-brand-600 px-6 text-sm font-medium text-white shadow-sm shadow-brand-600/30"
          >
            กลับหน้าหลัก
          </button>
        </div>
      </div>
    );
  }

  // Group by palletType, sort palletTypes by name, conditions by GOOD → PENDING_REPAIR → DAMAGED
  const grouped = new Map<string, Row[]>();
  for (const r of rows) {
    const k = r.palletType?.id ?? "unknown";
    grouped.set(k, [...(grouped.get(k) ?? []), r]);
  }
  const sortedGroups = Array.from(grouped.entries())
    .map(([ptId, list]) => ({
      ptId,
      name: list[0]?.palletType?.name ?? "-",
      active: list[0]?.palletType?.active ?? true,
      list: [...list].sort(
        (a, b) => CONDITION_ORDER.indexOf(a.condition) - CONDITION_ORDER.indexOf(b.condition)
      )
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div>
      <LiffTopBar title="ยอดคงเหลือในคลัง" />
      <div className="p-4">
        {error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div>}

        {sortedGroups.length === 0 ? (
          <LiffEmpty title="ไม่มีข้อมูล" />
        ) : (
          <div className="space-y-4">
            {sortedGroups.map(({ ptId, name, active, list }) => (
              <div key={ptId} className="rounded-2xl border border-border bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">{name}</p>
                    {!active && (
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600">ปิดการใช้งาน</span>
                    )}
                  </div>
                  <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700">
                    {list.reduce((s, r) => s + r.quantity, 0)}
                  </span>
                </div>
                <ul className="mt-3 divide-y divide-slate-100">
                  {list.map((r, i) => (
                    <li key={i} className="flex items-center justify-between py-2">
                      <span className={`text-sm font-medium ${CONDITION_COLOR[r.condition] ?? "text-slate-800"}`}>
                        {CONDITION_LABEL[r.condition] ?? r.condition}
                      </span>
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
