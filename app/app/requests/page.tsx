"use client";

// Library
import { useEffect, useState } from "react";
import Link from "next/link";
import { twMerge } from "tailwind-merge";

// Components
import { LiffTopBar, LiffEmpty, RequestCard } from "../_shared";
import type { RequestCardData } from "../_shared";
import { Skeleton } from "@/app/_components/ui";

type Req = RequestCardData;

type Tab = "pending" | "completed" | "rejected" | "cancelled";

const TABS: { id: Tab; label: string; statuses: string[] }[] = [
  { id: "pending", label: "รออนุมัติ", statuses: ["PENDING_DEPT", "PENDING_WAREHOUSE"] },
  { id: "completed", label: "อนุมัติแล้ว", statuses: ["COMPLETED"] },
  { id: "rejected", label: "ปฏิเสธ", statuses: ["REJECTED"] },
  { id: "cancelled", label: "ยกเลิก", statuses: ["CANCELLED"] }
];

const EMPTY_TEXT: Record<Tab, string> = {
  pending: "ไม่มีคำขอที่รออนุมัติ",
  completed: "ยังไม่มีคำขอที่อนุมัติแล้ว",
  rejected: "ไม่มีคำขอที่ถูกปฏิเสธ",
  cancelled: "ไม่มีคำขอที่ยกเลิก"
};

export default function Page() {
  const [list, setList] = useState<Req[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("pending");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/requests?scope=mine");
        const data = await res.json();
        if (!res.ok || !Array.isArray(data)) {
          setError(data?.error === "unauthenticated" ? "กรุณา login ก่อนใช้งาน" : (data?.error ?? "โหลดไม่สำเร็จ"));
          setList([]);
          return;
        }
        setList(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ");
        setList([]);
      }
    })();
  }, []);

  const activeStatuses = TABS.find((t) => t.id === tab)?.statuses ?? [];
  const filtered = list?.filter((r) => activeStatuses.includes(r.status)) ?? [];

  function countForTab(t: Tab) {
    const statuses = TABS.find((x) => x.id === t)?.statuses ?? [];
    return list?.filter((r) => statuses.includes(r.status)).length ?? 0;
  }

  if (list === null) {
    return (
      <div>
        <LiffTopBar title="คำขอของฉัน" backHref="/app" />
        <div className="space-y-3 p-4">
          <Skeleton className="h-10 w-full rounded-xl" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2 rounded-2xl border border-border bg-white p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1.5">
                  <Skeleton className="h-2.5 w-24" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-4 w-16 rounded-full" />
              </div>
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-2/5" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <LiffTopBar title="คำขอของฉัน" backHref="/app" />

      {/* Tab bar */}
      <div className="sticky top-14 z-10 border-b border-border bg-white">
        <div className="flex overflow-x-auto px-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((t) => {
            const count = countForTab(t.id);
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={twMerge(
                  "flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-3 text-xs font-medium transition-colors",
                  active ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-700"
                )}
              >
                {t.label}
                {count > 0 && (
                  <span
                    className={twMerge(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none",
                      active ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-slate-500"
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-4">
        {error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div>}

        {filtered.length === 0 ? (
          <LiffEmpty title={EMPTY_TEXT[tab]} />
        ) : (
          <ul className="space-y-3">
            {filtered.map((r) => (
              <li key={r.id}>
                <Link href={`/app/requests/${r.id}`} className="block">
                  <RequestCard r={r} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
