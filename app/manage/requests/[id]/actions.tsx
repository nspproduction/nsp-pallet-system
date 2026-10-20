"use client";

// Library
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/app/_components/dialogs";

interface Item {
  id: string;            // RequestItem.id — for stable React keys only
  palletTypeId: string;  // PalletType.id — sent to API
  palletType: string;    // palletType.name — display only
  condition: string;
  quantity: number;
}

interface Props {
  requestId: string;
  status: string;
  requesterId: string;
  items: Item[];
  currentUser: { id: string; roles: string[] };
}

const CONDITION_LABEL: Record<string, string> = {
  GOOD: "ดี",
  PENDING_REPAIR: "ส่งซ่อม",
  DAMAGED: "เสีย",
};

const PENDING_STATUSES = ["PENDING_DEPT", "PENDING_WAREHOUSE"];
const CLOSED_STATUSES = ["COMPLETED", "REJECTED", "CANCELLED"];

export function RequestActions({ requestId, status, requesterId, items, currentUser }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "approve" | "reject" | "cancel" | "edit">(null);
  const [err, setErr] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Edit & Approve state
  const [editMode, setEditMode] = useState(false);
  const [editItems, setEditItems] = useState<Item[]>(items);
  const [editReason, setEditReason] = useState("");

  const isSelfRequest = requesterId === currentUser.id;
  const canApprove =
    currentUser.roles.some((r) => ["DEPT_APPROVER", "PALLET_MANAGER", "ADMIN"].includes(r)) && !isSelfRequest;
  const canCancel = isSelfRequest || currentUser.roles.includes("ADMIN");
  const isPM = currentUser.roles.some((r) => ["PALLET_MANAGER", "ADMIN"].includes(r));
  const canEditApprove = isPM && status === "PENDING_WAREHOUSE" && !isSelfRequest;

  const isPending = PENDING_STATUSES.includes(status);
  const isClosed = CLOSED_STATUSES.includes(status);

  async function act(kind: "approve" | "reject" | "cancel", url: string, body?: unknown) {
    setBusy(kind);
    setErr(null);
    const isCancel = kind === "cancel";
    const res = await fetch(url, {
      method: isCancel ? "DELETE" : "POST",
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      setBusy(null);
      const data = await res.json().catch(() => ({}));
      setErr(data.error ?? "ทำรายการไม่สำเร็จ");
      return;
    }
    router.refresh();
    setBusy(null);
  }

  async function submitEditApprove() {
    if (!editReason.trim()) {
      setErr("กรุณาระบุเหตุผลการแก้ไข");
      return;
    }
    setBusy("edit");
    setErr(null);
    const res = await fetch(`/api/requests/${requestId}/edit-approve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        items: editItems.map((it) => ({
          palletTypeId: it.palletTypeId,
          condition: it.condition,
          quantity: it.quantity,
        })),
        reason: editReason,
      }),
    });
    if (!res.ok) {
      setBusy(null);
      const data = await res.json().catch(() => ({}));
      setErr(data.error ?? "ทำรายการไม่สำเร็จ");
      return;
    }
    router.refresh();
    setBusy(null);
  }

  const working = busy !== null;

  return (
    <>
      {showCancelConfirm && (
        <ConfirmDialog
          message="ยืนยันยกเลิกคำขอนี้?"
          confirmLabel="ยกเลิกคำขอ"
          danger
          onConfirm={() => {
            setShowCancelConfirm(false);
            act("cancel", `/api/requests/${requestId}`, undefined);
          }}
          onCancel={() => setShowCancelConfirm(false)}
        />
      )}
      <div className="space-y-4">
        {isPending && canApprove && (
          <>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">
                ความคิดเห็น (optional สำหรับอนุมัติ, บังคับสำหรับปฏิเสธ)
              </span>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </label>
            <div className="flex gap-2">
              <button
                disabled={working}
                onClick={() => act("approve", `/api/requests/${requestId}/approve`, { comment })}
                className="h-9 flex-1 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {busy === "approve" ? "กำลังบันทึก..." : "อนุมัติ"}
              </button>
              <button
                disabled={working || !comment.trim()}
                onClick={() => act("reject", `/api/requests/${requestId}/reject`, { comment })}
                className="h-9 flex-1 rounded-lg bg-rose-600 px-3 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {busy === "reject" ? "กำลังบันทึก..." : "ปฏิเสธ"}
              </button>
            </div>
          </>
        )}

        {isPending && canCancel && (
          <button
            disabled={working}
            onClick={() => setShowCancelConfirm(true)}
            className="h-9 w-full rounded-lg border border-rose-200 bg-white text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
          >
            {busy === "cancel" ? "กำลังยกเลิก..." : "ยกเลิกคำขอ"}
          </button>
        )}

        {canEditApprove && (
          <div className="border-t border-slate-100 pt-4">
            {!editMode ? (
              <button
                disabled={working}
                onClick={() => {
                  setEditItems(items);
                  setEditReason("");
                  setEditMode(true);
                }}
                className="h-9 w-full rounded-lg bg-amber-500 px-3 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
              >
                แก้ไขและอนุมัติ
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase text-slate-500">แก้ไขและอนุมัติ</p>

                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] font-semibold uppercase text-slate-500">
                      <th className="pb-2">ชนิด</th>
                      <th>สภาพ</th>
                      <th className="pb-2 text-right">จำนวน</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {editItems.map((it, idx) => (
                      <tr key={it.id}>
                        <td className="py-1.5 font-medium text-slate-900">{it.palletType}</td>
                        <td className="py-1.5 text-xs text-slate-500">
                          {CONDITION_LABEL[it.condition] ?? it.condition}
                        </td>
                        <td className="py-1.5 text-right">
                          <input
                            type="number"
                            min={1}
                            value={it.quantity}
                            onChange={(e) => {
                              const qty = Math.max(1, parseInt(e.target.value) || 1);
                              setEditItems((prev) =>
                                prev.map((item, i) => (i === idx ? { ...item, quantity: qty } : item)),
                              );
                            }}
                            className="w-20 rounded border border-slate-200 px-2 py-1 text-right text-sm"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <label className="block">
                  <span className="text-xs font-medium text-slate-600">เหตุผลการแก้ไข *</span>
                  <textarea
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    rows={2}
                    placeholder="ระบุเหตุผลที่แก้ไขรายการ..."
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  />
                </label>

                <div className="flex gap-2">
                  <button
                    disabled={working || !editReason.trim()}
                    onClick={submitEditApprove}
                    className="h-9 flex-1 rounded-lg bg-amber-500 px-3 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
                  >
                    {busy === "edit" ? "กำลังบันทึก..." : "ยืนยันแก้ไขและอนุมัติ"}
                  </button>
                  <button
                    disabled={working}
                    onClick={() => setEditMode(false)}
                    className="h-9 rounded-lg border border-slate-200 px-3 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    ยกเลิก
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {isClosed && (
          <p className="text-sm text-slate-500">คำขอนี้ปิดแล้ว ไม่มีการดำเนินการเพิ่มเติม</p>
        )}

        {err && <p className="rounded bg-rose-50 p-2 text-xs text-rose-700">{err}</p>}
      </div>
    </>
  );
}
