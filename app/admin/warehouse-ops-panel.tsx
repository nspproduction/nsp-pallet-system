"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Row {
  id: string;
  code: string;
  name: string;
  usable: number;
  inRepair: number;
  unusable: number;
}

type Op = "repair" | "write-off";

export function WarehouseOpsPanel({ rows }: { rows: Row[] }) {
  const [modal, setModal] = useState<{ op: Op; row: Row } | null>(null);
  const router = useRouter();

  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-sm text-slate-500">
        ยังไม่มีข้อมูลพาเลทในคลัง
      </p>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <th className="pb-2">รหัส</th>
              <th className="pb-2">ชนิดพาเลท</th>
              <th className="pb-2 text-right">ดี</th>
              <th className="pb-2 text-right">รอซ่อม</th>
              <th className="pb-2 text-right">เสีย</th>
              <th className="pb-2 text-right">การจัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="py-3 font-mono text-xs text-slate-500">{r.code}</td>
                <td className="py-3 font-medium text-slate-900">{r.name}</td>
                <td className="py-3 text-right font-mono text-emerald-700">{r.usable}</td>
                <td className="py-3 text-right font-mono text-amber-700">{r.inRepair}</td>
                <td className="py-3 text-right font-mono text-rose-700">{r.unusable}</td>
                <td className="py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      disabled={r.inRepair === 0}
                      onClick={() => setModal({ op: "repair", row: r })}
                      className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-300"
                    >
                      ซ่อม
                    </button>
                    <button
                      disabled={r.unusable === 0}
                      onClick={() => setModal({ op: "write-off", row: r })}
                      className="rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-300"
                    >
                      ตัดจำหน่าย
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <OpModal
          op={modal.op}
          row={modal.row}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function OpModal({
  op,
  row,
  onClose,
  onDone,
}: {
  op: Op;
  row: Row;
  onClose: () => void;
  onDone: () => void;
}) {
  const isRepair = op === "repair";
  const maxQty = isRepair ? row.inRepair : row.unusable;
  const [quantity, setQuantity] = useState<string>(String(maxQty));
  const [note, setNote] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const q = Number(quantity);
  const canSubmit =
    !busy && q > 0 && q <= maxQty && (isRepair || note.trim().length > 0);

  async function submit() {
    setBusy(true);
    setErr(null);
    const url = isRepair ? "/api/warehouse-ops/repair" : "/api/warehouse-ops/write-off";
    const body = isRepair
      ? { palletTypeId: row.id, quantity: q, note: note.trim() || undefined }
      : { palletTypeId: row.id, condition: "UNUSABLE", quantity: q, note: note.trim() };
    const res = await fetch(url, {
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
    onDone();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">
            {isRepair ? "ซ่อมพาเลท" : "ตัดจำหน่ายพาเลท"}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-900">
            ✕
          </button>
        </div>

        <div className="mt-3 rounded-lg bg-slate-50 p-3">
          <p className="font-mono text-[11px] text-slate-500">{row.code}</p>
          <p className="text-sm font-semibold text-slate-900">{row.name}</p>
          <p className="mt-2 text-xs text-slate-600">
            {isRepair
              ? `รอซ่อม ${row.inRepair} → แปลงเป็นสภาพ "ดี"`
              : `เสีย ${row.unusable} → ตัดออกจากคลัง`}
          </p>
        </div>

        <label className="mt-4 block">
          <span className="text-xs font-medium text-slate-600">จำนวน (สูงสุด {maxQty})</span>
          <input
            type="number"
            min={1}
            max={maxQty}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
          />
        </label>

        <label className="mt-3 block">
          <span className="text-xs font-medium text-slate-600">
            หมายเหตุ {isRepair ? "(ไม่บังคับ)" : "(บังคับ)"}
          </span>
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={isRepair ? "เช่น ซ่อมเปลี่ยนไม้ 2 แผ่น" : "ระบุเหตุผลการตัดจำหน่าย"}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          />
        </label>

        {err && <p className="mt-3 rounded-lg bg-rose-50 p-2 text-xs text-rose-700">{err}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg border border-slate-200 px-4 text-sm text-slate-700"
          >
            ยกเลิก
          </button>
          <button
            disabled={!canSubmit}
            onClick={submit}
            className={`h-9 rounded-lg px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 ${
              isRepair ? "bg-amber-600 hover:bg-amber-700" : "bg-rose-600 hover:bg-rose-700"
            }`}
          >
            {busy ? "กำลังบันทึก..." : isRepair ? "ยืนยันซ่อม" : "ยืนยันตัดจำหน่าย"}
          </button>
        </div>
      </div>
    </div>
  );
}
