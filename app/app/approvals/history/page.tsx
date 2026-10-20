"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { twMerge } from "tailwind-merge";

import { LiffTopBar, LiffEmpty, RequestCard } from "../../_shared";
import type { RequestCardData } from "../../_shared";
import { Skeleton } from "@/app/_components/ui";
import { safeFetchJson } from "../../_fetch";

type Req = RequestCardData & {
  requester: { fullName: string };
  approvals: { id: string; decision: string; comment: string | null; decidedAt: string }[];
};

type Tab = "approved" | "rejected";

const TABS: { id: Tab; label: string; decisions: string[] }[] = [
  { id: "approved", label: "อนุมัติ", decisions: ["APPROVED"] },
  { id: "rejected", label: "ปฏิเสธ", decisions: ["REJECTED"] }
];

const EMPTY_TEXT: Record<Tab, string> = {
  approved: "ยังไม่มีคำขอที่อนุมัติ",
  rejected: "ยังไม่มีคำขอที่ปฏิเสธ"
};

export default function Page() {
  const router = useRouter();
  const [list, setList] = useState<Req[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("approved");

  useEffect(() => {
    void (async () => {
      const { data, error } = await safeFetchJson<Req[]>("/api/requests?scope=i-approved");
      setError(error);
      setList(Array.isArray(data) ? data : []);
    })();
  }, []);

  const activeDecisions = TABS.find((t) => t.id === tab)?.decisions ?? [];
  const filtered =
    list?.filter((r) => {
      const decision = r.approvals[0]?.decision;
      return decision ? activeDecisions.includes(decision) : false;
    }) ?? [];

  function countForTab(t: Tab) {
    const decisions = TABS.find((x) => x.id === t)?.decisions ?? [];
    return (
      list?.filter((r) => {
        const decision = r.approvals[0]?.decision;
        return decision ? decisions.includes(decision) : false;
      }).length ?? 0
    );
  }

  if (list === null) {
    return (
      <div>
        <LiffTopBar title="ประวัติอนุมัติ" />
        <div className="space-y-3 p-4">
          <Skeleton className="h-10 w-full rounded-xl" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2 rounded-2xl border border-border bg-white p-4">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <LiffTopBar title="ประวัติอนุมัติ" />

      {/* Tab bar */}
      <div className="sticky top-14 z-10 border-b border-border bg-white">
        <div className="flex px-4">
          {TABS.map((t) => {
            const count = countForTab(t.id);
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={twMerge(
                  "flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-3 text-xs font-medium transition-colors",
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
          <LiffEmpty title={EMPTY_TEXT[tab]} subtitle="คำขอที่คุณอนุมัติหรือปฏิเสธจะปรากฏที่นี่" />
        ) : (
          <ul className="space-y-3">
            {filtered.map((r) => {
              const myDecision = r.approvals[0];
              return (
                <li key={r.id}>
                  <RequestCard
                    r={r}
                    onClick={() => router.push(`/app/requests/${r.id}`)}
                    trailing={
                      <>
                        <p className="mt-2 text-[11px] text-slate-500">โดย {r.requester.fullName}</p>
                        {myDecision && (
                          <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                            <span className={`text-xs font-semibold ${myDecision.decision === "REJECTED" ? "text-rose-700" : "text-emerald-700"}`}>
                              {myDecision.decision === "REJECTED" ? "ปฏิเสธ" : "อนุมัติ"}
                            </span>
                            <span className="text-[11px] text-slate-500">{new Date(myDecision.decidedAt).toLocaleString("th-TH")}</span>
                          </div>
                        )}
                        {myDecision?.comment && <p className="mt-2 text-xs text-slate-600">{myDecision.comment}</p>}
                      </>
                    }
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
