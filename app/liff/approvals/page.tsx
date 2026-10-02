"use client";

// Library
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Components
import { LiffTopBar, LiffEmpty, TYPE_LABEL } from "../_shared";
import { Skeleton } from "@/app/_components/ui";

// Lib
import { safeFetchJson } from "../_fetch";

interface Req {
  id: string;
  docNo: string;
  type: string;
  status: string;
  requester: { fullName: string };
  fromDepartment?: { name: string } | null;
  toDepartment?: { name: string } | null;
  items: { id: string; palletType: { name: string }; quantity: number }[];
}

export default function Page() {
  const router = useRouter();
  const [list, setList] = useState<Req[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { load(); }, []);
  async function load() {
    const { data, error } = await safeFetchJson<Req[]>("/api/requests?scope=to-approve");
    setError(error);
    setList(Array.isArray(data) ? data : []);
  }

  async function act(reqId: string, kind: "approve" | "reject") {
    setBusyId(reqId);
    const body = kind === "reject" ? { comment: comment.trim() } : { comment: comment.trim() || undefined };
    const res = await fetch(`/api/requests/${reqId}/${kind}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusyId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "ทำรายการไม่สำเร็จ");
      return;
    }
    setComment("");
    setOpenId(null);
    load();
  }

  if (list === null) {
    return (
      <div>
        <LiffTopBar title="รออนุมัติ" />
        <div className="space-y-3 p-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-3 rounded-2xl border border-border bg-white p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1.5">
                  <Skeleton className="h-2.5 w-24" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-7 w-10 rounded-full" />
              </div>
              <Skeleton className="h-3 w-3/4" />
              <div className="space-y-1.5">
                <Skeleton className="h-6 w-full rounded" />
                <Skeleton className="h-6 w-full rounded" />
              </div>
              <Skeleton className="h-9 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <LiffTopBar title="รออนุมัติ" />
      <div className="p-4">
        {error && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            {error}
          </div>
        )}

        {list.length === 0 ? (
          <LiffEmpty title="ไม่มีคำขอรออนุมัติ" subtitle="เมื่อมีคำขอใหม่ระบบจะแจ้งเตือนผ่าน LINE" />
        ) : (
          <ul className="space-y-3">
            {list.map((r) => (
              <li key={r.id} className="rounded-2xl border border-border bg-white p-4">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-slate-500">{r.docNo}</p>
                    <p className="mt-0.5 text-sm font-semibold text-slate-900">{TYPE_LABEL[r.type] ?? r.type}</p>
                    <p className="mt-1 text-xs text-slate-500">โดย {r.requester.fullName}</p>
                  </div>
                  <button
                    onClick={() => router.push(`/liff/requests/${r.id}`)}
                    className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700"
                  >
                    ดู
                  </button>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {r.fromDepartment?.name ?? "-"} → {r.toDepartment?.name ?? "-"}
                </p>
                <ul className="mt-2 space-y-1">
                  {r.items.map((it) => (
                    <li key={it.id} className="rounded bg-slate-50 px-2 py-1 text-xs text-slate-700">
                      {it.palletType.name} × {it.quantity}
                    </li>
                  ))}
                </ul>

                {openId === r.id ? (
                  <div className="mt-3 space-y-2">
                    <textarea
                      placeholder="ความคิดเห็น (บังคับสำหรับปฏิเสธ)"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      rows={2}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                    />
                    <div className="flex gap-2">
                      <button
                        disabled={busyId === r.id}
                        onClick={() => act(r.id, "approve")}
                        className="h-9 flex-1 rounded-lg bg-emerald-600 text-xs font-medium text-white disabled:opacity-50"
                      >
                        อนุมัติ
                      </button>
                      <button
                        disabled={busyId === r.id || !comment.trim()}
                        onClick={() => act(r.id, "reject")}
                        className="h-9 flex-1 rounded-lg bg-rose-600 text-xs font-medium text-white disabled:opacity-50"
                      >
                        ปฏิเสธ
                      </button>
                      <button
                        onClick={() => { setOpenId(null); setComment(""); }}
                        className="h-9 rounded-lg border border-slate-200 px-3 text-xs text-slate-700"
                      >
                        ปิด
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setOpenId(r.id)}
                    className="mt-3 h-9 w-full rounded-lg bg-brand-600 text-xs font-medium text-white"
                  >
                    ตัดสินใจ
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
