"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Item {
  id: string;
  palletType: string;
  condition: string;
  quantity: number;
}

interface Props {
  requestId: string;
  status: string;
  requesterId: string;
  items: Item[];
  currentUser: { id: string; role: string };
}

export function RequestActions({ requestId, status, requesterId, currentUser }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [comment, setComment] = useState("");

  const isSelfRequest = requesterId === currentUser.id;
  const canApprove = (currentUser.role === "APPROVER" || currentUser.role === "ADMIN") && !isSelfRequest;
  const canCancel = isSelfRequest || currentUser.role === "ADMIN";

  async function act(url: string, body?: unknown) {
    setBusy(true);
    setErr(null);
    const isCancel = !url.includes("/approve") && !url.includes("/reject");
    const res = await fetch(url, {
      method: isCancel ? "DELETE" : "POST",
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErr(data.error ?? "ทำรายการไม่สำเร็จ");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {status === "PENDING" && canApprove && (
        <>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">ความคิดเห็น (optional สำหรับอนุมัติ, บังคับสำหรับปฏิเสธ)</span>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </label>
          <div className="flex gap-2">
            <button
              disabled={busy}
              onClick={() => act(`/api/requests/${requestId}/approve`, { comment })}
              className="h-9 flex-1 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              อนุมัติ
            </button>
            <button
              disabled={busy || !comment.trim()}
              onClick={() => act(`/api/requests/${requestId}/reject`, { comment })}
              className="h-9 flex-1 rounded-lg bg-rose-600 px-3 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
            >
              ปฏิเสธ
            </button>
          </div>
        </>
      )}

      {status === "PENDING" && canCancel && (
        <button
          disabled={busy}
          onClick={() => confirm("ยืนยันยกเลิกคำขอ?") && act(`/api/requests/${requestId}`, undefined)}
          className="h-9 w-full rounded-lg border border-rose-200 bg-white text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
        >
          ยกเลิกคำขอ
        </button>
      )}

      {(status === "APPROVED" || status === "REJECTED" || status === "CANCELLED") && (
        <p className="text-sm text-slate-500">คำขอนี้ปิดแล้ว ไม่มีการดำเนินการเพิ่มเติม</p>
      )}

      {err && <p className="rounded bg-rose-50 p-2 text-xs text-rose-700">{err}</p>}
    </div>
  );
}
