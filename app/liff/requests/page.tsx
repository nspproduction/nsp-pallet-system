"use client";

// Library
import { useEffect, useState } from "react";
import Link from "next/link";

// Components
import { LiffTopBar, LiffEmpty, RequestCard } from "../_shared";
import type { RequestCardData } from "../_shared";
import { Skeleton } from "@/app/_components/ui";

type Req = RequestCardData;

export default function Page() {
  const [list, setList] = useState<Req[] | null>(null);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/requests?scope=mine");
        const data = await res.json();
        if (!res.ok || !Array.isArray(data)) {
          setError(data?.error === "unauthenticated" ? "กรุณา login ที่หน้าแรกของ LIFF ก่อน" : (data?.error ?? "โหลดไม่สำเร็จ"));
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

  if (list === null) {
    return (
      <div>
        <LiffTopBar title="คำขอของฉัน" />
        <div className="space-y-3 p-4">
          <Skeleton className="h-12 w-full rounded-xl" />
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
      <LiffTopBar title="คำขอของฉัน" />
      <div className="p-4">
        <Link
          href="/liff/requests/new"
          className="mb-4 flex h-12 items-center justify-center gap-2 rounded-xl bg-brand-600 text-sm font-medium text-white shadow-sm shadow-brand-600/30"
        >
          + สร้างคำขอใหม่
        </Link>

        {error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div>}

        {list.length === 0 ? (
          <LiffEmpty title="ยังไม่มีคำขอ" subtitle={error ? "" : "กดปุ่มด้านบนเพื่อสร้างคำขอแรก"} />
        ) : (
          <ul className="space-y-3">
            {list.map((r) => (
              <li key={r.id}>
                <Link href={`/liff/requests/${r.id}`} className="block">
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
