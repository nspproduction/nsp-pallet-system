"use client";

// Library
import { useState } from "react";
import { useRouter } from "next/navigation";

interface PT { id: string; code: string; name: string; }
interface Dept { id: string; code: string; name: string; }

const inputCls = "w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-brand-500 focus:outline-none";

export function AdjustmentsClient({
  palletTypes,
  departments,
}: {
  palletTypes: PT[];
  departments: Dept[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fromId, setFromId] = useState<string>("");
  const [toId, setToId] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [reason, setReason] = useState<string>("");

  const canSubmit = !busy && (fromId || toId) && Number(quantity) > 0 && reason.trim().length > 0;

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
    setOpen(false);
    setFromId("");
    setToId("");
    setQuantity("");
    setReason("");
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-600 px-3.5 text-sm font-medium text-white shadow-sm shadow-brand-600/30 hover:bg-brand-700"
      >
        + ปรับยอด
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <h3 className="text-base font-semibold text-slate-900">ปรับยอดสต็อก</h3>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-900">✕</button>
            </div>
            <form onSubmit={submit} className="space-y-3 p-5">
              <label className="block">
                <span className="text-xs font-medium text-slate-600">พาเลท</span>
                <select name="palletTypeId" required className={`mt-1 ${inputCls}`}>
                  {palletTypes.map((p) => <option key={p.id} value={p.id}>{p.code} - {p.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-600">สถานะ</span>
                <select name="condition" required className={`mt-1 ${inputCls}`}>
                  <option value="USABLE">ดี</option>
                  <option value="IN_REPAIR">ส่งซ่อม</option>
                  <option value="UNUSABLE">เสีย</option>
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">จาก (ออก)</span>
                  <select
                    value={fromId}
                    onChange={(e) => setFromId(e.target.value)}
                    className={`mt-1 ${inputCls}`}
                  >
                    <option value="">-</option>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.code} · {d.name}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">ไป (เข้า)</span>
                  <select
                    value={toId}
                    onChange={(e) => setToId(e.target.value)}
                    className={`mt-1 ${inputCls}`}
                  >
                    <option value="">-</option>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.code} · {d.name}</option>)}
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
                * ระบุ "จาก" ถ้าต้องการลดสต็อก, ระบุ "ไป" ถ้าต้องการเพิ่มสต็อก, ระบุทั้งคู่คือย้ายระหว่างแผนก
              </p>
              {!fromId && !toId && (
                <p className="text-xs text-amber-700">กรุณาระบุ "จาก" หรือ "ไป" อย่างน้อย 1 อย่าง</p>
              )}
              {err && <p className="text-xs text-rose-600">{err}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="h-9 rounded-lg border border-slate-200 px-4 text-sm">ยกเลิก</button>
                <button
                  disabled={!canSubmit}
                  className="h-9 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? "กำลังบันทึก..." : "บันทึก"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
