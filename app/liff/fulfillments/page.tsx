"use client";

// Library
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Components
import { LiffTopBar, LiffEmpty, TYPE_LABEL } from "../_shared";
import { Skeleton } from "@/app/_components/ui";

// Lib
import { safeFetchJson } from "../_fetch";

interface Item {
  id: string;
  palletType: { name: string };
  condition: string;
  quantity: number;
}

interface Req {
  id: string;
  docNo: string;
  type: string;
  status: string;
  requester: { fullName: string };
  fromDepartment?: { name: string } | null;
  toDepartment?: { name: string } | null;
  items: Item[];
}

const CONDITION_LABEL: Record<string, string> = {
  USABLE: "ดี",
  IN_REPAIR: "ส่งซ่อม",
  UNUSABLE: "เสีย",
};

export default function Page() {
  const router = useRouter();
  const [list, setList] = useState<Req[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [actuals, setActuals] = useState<Record<string, string>>({});
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { load(); }, []);
  async function load() {
    const { data, error } = await safeFetchJson<Req[]>("/api/requests?scope=to-fulfill");
    setError(error);
    setList(Array.isArray(data) ? data : []);
  }

  function openFulfill(r: Req) {
    setOpenId(r.id);
    setComment("");
    setActuals(Object.fromEntries(r.items.map((it) => [it.id, String(it.quantity)])));
  }

  async function submit(r: Req) {
    setBusyId(r.id);
    const res = await fetch(`/api/requests/${r.id}/fulfill`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        actuals: r.items.map((it) => ({ requestItemId: it.id, actualQuantity: Number(actuals[it.id] || 0) })),
        comment: comment.trim() || undefined,
      }),
    });
    setBusyId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "ทำรายการไม่สำเร็จ");
      return;
    }
    setOpenId(null);
    setComment("");
    load();
  }

  if (list === null) {
    return (
      <div>
        <LiffTopBar title="คำขอรอจ่าย/รอรับ" />
        <div className="space-y-3 p-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-3 rounded-2xl border border-border bg-white p-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
              <Skeleton className="h-9 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <LiffTopBar title="คำขอรอจ่าย/รอรับ" />
      <div className="p-4">
        {error && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            {error}
          </div>
        )}

        {list.length === 0 ? (
          <LiffEmpty title="ไม่มีคำขอรอดำเนินการ" subtitle="คำขอที่อนุมัติแล้วจะปรากฏที่นี่" />
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

                {openId === r.id ? (
                  <div className="mt-3 space-y-2">
                    <p className="text-[11px] text-slate-500">กรอกยอดจริงต่อรายการ</p>
                    {r.items.map((it) => (
                      <div key={it.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 p-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-slate-800">{it.palletType.name}</p>
                          <p className="text-[10px] text-slate-500">{CONDITION_LABEL[it.condition] ?? it.condition} · ขอ {it.quantity}</p>
                        </div>
                        <input
                          type="number"
                          min={0}
                          value={actuals[it.id] ?? ""}
                          onChange={(e) => setActuals({ ...actuals, [it.id]: e.target.value })}
                          className="h-9 w-20 rounded border border-slate-200 bg-white px-2 text-right text-sm"
                        />
                      </div>
                    ))}
                    <textarea
                      placeholder="หมายเหตุ (ไม่บังคับ)"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      rows={2}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                    />
                    <div className="flex gap-2">
                      <button
                        disabled={busyId === r.id}
                        onClick={() => submit(r)}
                        className="h-9 flex-1 rounded-lg bg-brand-600 text-xs font-medium text-white disabled:opacity-50"
                      >
                        ยืนยันส่งมอบ
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
                  <>
                    <ul className="mt-2 space-y-1">
                      {r.items.map((it) => (
                        <li key={it.id} className="rounded bg-slate-50 px-2 py-1 text-xs text-slate-700">
                          {it.palletType.name} × {it.quantity} <span className="text-slate-400">({CONDITION_LABEL[it.condition] ?? it.condition})</span>
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={() => openFulfill(r)}
                      className="mt-3 h-9 w-full rounded-lg bg-brand-600 text-xs font-medium text-white"
                    >
                      ยืนยันส่งมอบ
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
