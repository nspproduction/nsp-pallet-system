"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { LiffTopBar, LiffEmpty, RequestCard } from "../../_shared";
import type { RequestCardData } from "../../_shared";
import { Skeleton } from "@/app/_components/ui";
import { safeFetchJson } from "../../_fetch";

type Req = RequestCardData & {
  requester: { fullName: string };
  approvals: { id: string; decision: string; comment: string | null; decidedAt: string }[];
};

export default function Page() {
  const router = useRouter();
  const [list, setList] = useState<Req[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data, error } = await safeFetchJson<Req[]>("/api/requests?scope=i-approved");
      setError(error);
      setList(Array.isArray(data) ? data : []);
    })();
  }, []);

  if (list === null) {
    return (
      <div>
        <LiffTopBar title="ประวัติอนุมัติ" />
        <div className="space-y-3 p-4">
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
      <div className="p-4">
        {error && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            {error}
          </div>
        )}

        {list.length === 0 ? (
          <LiffEmpty title="ยังไม่มีประวัติอนุมัติ" subtitle="คำขอที่คุณอนุมัติหรือปฏิเสธจะปรากฏที่นี่" />
        ) : (
          <ul className="space-y-3">
            {list.map((r) => {
              const myDecision = r.approvals[0];
              return (
                <li key={r.id}>
                  <RequestCard
                    r={r}
                    onClick={() => router.push(`/liff/requests/${r.id}`)}
                    trailing={
                      <>
                        <p className="mt-2 text-[11px] text-slate-500">โดย {r.requester.fullName}</p>
                        {myDecision && (
                          <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                            <span
                              className={`text-xs font-semibold ${
                                myDecision.decision === "APPROVED" ? "text-emerald-700" : "text-rose-700"
                              }`}
                            >
                              {myDecision.decision === "APPROVED" ? "อนุมัติ" : "ปฏิเสธ"}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              {new Date(myDecision.decidedAt).toLocaleString("th-TH")}
                            </span>
                          </div>
                        )}
                        {myDecision?.comment && (
                          <p className="mt-2 text-xs text-slate-600">{myDecision.comment}</p>
                        )}
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
