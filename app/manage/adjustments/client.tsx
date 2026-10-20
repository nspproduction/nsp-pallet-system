"use client";

// Library
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface PT {
  id: string;
  name: string;
}
interface Dept {
  id: string;
  name: string;
}

const inputCls = "w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-brand-500 focus:outline-none";
const ERR_CLS = "rounded bg-rose-50 px-2 py-1.5 text-xs text-rose-700";

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-2xl bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="text-slate-400 hover:text-slate-900"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function AdjustmentsClient({ palletTypes, departments }: { palletTypes: PT[]; departments: Dept[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fromId, setFromId] = useState<string>("");
  const [toId, setToId] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [reason, setReason] = useState<string>("");

  function resetForm() {
    setFromId("");
    setToId("");
    setQuantity("");
    setReason("");
    setErr(null);
  }

  function closeModal() {
    setOpen(false);
    resetForm();
  }

  const sameDept = Boolean(fromId && toId && fromId === toId);
  const canSubmit = !busy && (fromId || toId) && !sameDept && Number(quantity) > 0 && reason.trim().length > 0;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const fd = new FormData(e.currentTarget);
    const body = {
      palletTypeId: String(fd.get("palletTypeId")),
      condition: String(fd.get("condition")),
      fromDepartmentId: fromId || null,
      toDepartmentId: toId || null,
      quantity: Number(quantity),
      reason: reason.trim(),
    };
    const res = await fetch("/api/adjustments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErr(data.error ?? "บันทึกไม่สำเร็จ");
      return;
    }
    closeModal();
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-600 px-3.5 text-sm font-medium text-white shadow-sm shadow-brand-600/30 hover:bg-brand-700"
      >
        + ปรับยอด
      </button>
      {open && (
        <Modal title="ปรับยอดสต็อก" onClose={closeModal}>
          <form onSubmit={submit} className="space-y-3 p-5">
            <label className="block">
              <span className="text-xs font-medium text-slate-600">พาเลท</span>
              <select name="palletTypeId" required className={`mt-1 ${inputCls}`}>
                {palletTypes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">สภาพ</span>
              <select name="condition" required className={`mt-1 ${inputCls}`}>
                <option value="GOOD">ดี</option>
                <option value="PENDING_REPAIR">ส่งซ่อม</option>
                <option value="DAMAGED">เสีย</option>
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-medium text-slate-600">จาก (ออก)</span>
                <select value={fromId} onChange={(e) => setFromId(e.target.value)} className={`mt-1 ${inputCls}`}>
                  <option value="">-</option>
                  {departments.filter((d) => d.id !== toId).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-600">ไป (เข้า)</span>
                <select value={toId} onChange={(e) => setToId(e.target.value)} className={`mt-1 ${inputCls}`}>
                  <option value="">-</option>
                  {departments.filter((d) => d.id !== fromId).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">จำนวน</span>
              <input
                type="number"
                min={1}
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className={`mt-1 ${inputCls}`}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">เหตุผล</span>
              <textarea
                required
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </label>
            <p className="text-xs text-slate-500">
              * ระบุ &quot;จาก&quot; ถ้าต้องการลดสต็อก, ระบุ &quot;ไป&quot; ถ้าต้องการเพิ่มสต็อก, ระบุทั้งคู่คือย้ายระหว่างแผนก
            </p>
            {!fromId && !toId && (
              <p className="text-xs text-amber-700">กรุณาระบุ &quot;จาก&quot; หรือ &quot;ไป&quot; อย่างน้อย 1 อย่าง</p>
            )}
            {err && <p className={ERR_CLS}>{err}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={closeModal} className="h-9 rounded-lg border border-slate-200 px-4 text-sm">
                ยกเลิก
              </button>
              <button
                disabled={!canSubmit}
                className="h-9 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
