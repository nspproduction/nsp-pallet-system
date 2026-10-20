"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { LiffTopBar, LiffEmpty } from "../_shared";
import { Skeleton } from "@/app/_components/ui";
import { safeFetchJson } from "../_fetch";

interface Row {
  id: string;
  name: string;
  active: boolean;
  usable: number;
  inRepair: number;
  unusable: number;
}

interface MeResponse {
  authenticated: boolean;
  user?: { id: string; roles: string[] };
}

type Op = "repair" | "write-off";

export default function Page() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ op: Op; row: Row } | null>(null);

  useEffect(() => {
    void (async () => {
      const [meRes, sumRes] = await Promise.all([
        safeFetchJson<MeResponse>("/api/auth/me"),
        safeFetchJson<Row[]>("/api/warehouse-ops/summary")
      ]);
      setMe(meRes.data ?? null);
      setError(sumRes.error);
      setRows(Array.isArray(sumRes.data) ? sumRes.data : []);
    })();
  }, []);

  async function load() {
    const { data, error } = await safeFetchJson<Row[]>("/api/warehouse-ops/summary");
    setError(error);
    setRows(Array.isArray(data) ? data : []);
  }

  const roles = me?.user?.roles ?? [];
  const canManage = roles.some((r) => ["PALLET_MANAGER", "ADMIN"].includes(r));

  if (rows === null || me === null) {
    return (
      <div>
        <LiffTopBar title="จัดการคลังพาเลท" />
        <div className="space-y-3 p-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2 rounded-2xl border border-border bg-white p-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
              <Skeleton className="h-9 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!canManage) {
    return (
      <div>
        <LiffTopBar title="จัดการคลังพาเลท" />
        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-rose-100 text-2xl text-rose-500">🚫</div>
          <p className="mt-4 text-sm font-semibold text-slate-800">บทบาทของคุณไม่สามารถเข้าถึงหน้านี้ได้</p>
          <p className="mt-1 max-w-xs text-xs text-slate-500">เฉพาะ Pallet Manager และ Admin เท่านั้น</p>
          <button
            onClick={() => router.push("/app")}
            className="mt-6 h-10 rounded-full bg-brand-600 px-6 text-sm font-medium text-white shadow-sm shadow-brand-600/30"
          >
            กลับหน้าหลัก
          </button>
        </div>
      </div>
    );
  }

  const actionable = rows.filter((r) => r.inRepair > 0 || r.unusable > 0);

  return (
    <div>
      <LiffTopBar title="จัดการคลังพาเลท" />
      <div className="p-4">
        {error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div>}
        <p className="mb-3 text-xs text-slate-500">ซ่อมพาเลทที่รอซ่อม หรือ ตัดจำหน่ายพาเลทที่เสีย — ปรับยอดในคลังทันที</p>

        {actionable.length === 0 ? (
          <LiffEmpty title="ไม่มีพาเลทที่ต้องจัดการ" subtitle="ยอดในคลังสะอาด (ไม่มีรอซ่อม / เสีย)" />
        ) : (
          <ul className="space-y-3">
            {actionable.map((r) => (
              <li key={r.id} className="rounded-2xl border border-border bg-white p-4">
                <div className="flex items-center gap-2">
                  <p className="mt-0.5 text-sm font-semibold text-slate-900">{r.name}</p>
                  {!r.active && (
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600">ปิดการใช้งาน</span>
                  )}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <Counter label="ดี" value={r.usable} tone="emerald" />
                  <Counter label="รอซ่อม" value={r.inRepair} tone="amber" />
                  <Counter label="เสีย" value={r.unusable} tone="rose" />
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    disabled={r.inRepair === 0}
                    onClick={() => setModal({ op: "repair", row: r })}
                    className="h-9 flex-1 rounded-lg bg-amber-600 text-xs font-medium text-white disabled:bg-slate-200 disabled:text-slate-400"
                  >
                    ซ่อม
                  </button>
                  <button
                    disabled={r.unusable === 0}
                    onClick={() => setModal({ op: "write-off", row: r })}
                    className="h-9 flex-1 rounded-lg bg-rose-600 text-xs font-medium text-white disabled:bg-slate-200 disabled:text-slate-400"
                  >
                    ตัดจำหน่าย
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {modal && (
        <OpModal
          op={modal.op}
          row={modal.row}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function Counter({ label, value, tone }: { label: string; value: number; tone: "emerald" | "amber" | "rose" }) {
  const bg = { emerald: "bg-emerald-50", amber: "bg-amber-50", rose: "bg-rose-50" }[tone];
  const text = { emerald: "text-emerald-700", amber: "text-amber-700", rose: "text-rose-700" }[tone];
  return (
    <div className={`rounded-lg p-2 ${bg}`}>
      <p className={`text-[10px] font-medium uppercase tracking-wider ${text}`}>{label}</p>
      <p className={`mt-0.5 font-mono text-lg font-semibold ${text}`}>{value}</p>
    </div>
  );
}

function OpModal({ op, row, onClose, onDone }: { op: Op; row: Row; onClose: () => void; onDone: () => void }) {
  const isRepair = op === "repair";
  const maxQty = isRepair ? row.inRepair : row.unusable;

  // Write-off
  const [woQty, setWoQty] = useState<string>("");
  // Repair split
  const [repairedQty, setRepairedQty] = useState<string>("0");
  const [damagedQty, setDamagedQty] = useState<string>("0");

  const [note, setNote] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const repaired = Number(repairedQty);
  const damaged = Number(damagedQty);
  const wo = Number(woQty);
  const repairTotal = repaired + damaged;

  const canSubmit =
    !busy &&
    (isRepair ? repairTotal > 0 && repairTotal <= maxQty && repaired >= 0 && damaged >= 0 : wo > 0 && wo <= maxQty && note.trim().length > 0);

  async function submit() {
    setBusy(true);
    setErr(null);
    const url = isRepair ? "/api/warehouse-ops/repair" : "/api/warehouse-ops/write-off";
    const body = isRepair
      ? { palletTypeId: row.id, repairedQty: repaired, damagedQty: damaged, note: note.trim() || undefined }
      : { palletTypeId: row.id, condition: "DAMAGED", quantity: wo, note: note.trim() };
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">{isRepair ? "บันทึกผลซ่อม" : "ตัดจำหน่ายพาเลท"}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-900">
            ✕
          </button>
        </div>

        <div className="mt-3 rounded-lg bg-slate-50 p-3">
          <p className="text-sm font-semibold text-slate-900">{row.name}</p>
          <p className="mt-1 text-xs text-slate-500">{isRepair ? `รอซ่อม ${row.inRepair} ใบ` : `เสีย ${row.unusable} ใบ`}</p>
        </div>

        {isRepair ? (
          <div className="mt-4 space-y-3">
            <p className="text-xs font-medium text-slate-600">ระบุผลซ่อม (รวมต้องไม่เกิน {maxQty})</p>
            <label className="block">
              <span className="text-xs text-slate-500">ซ่อมได้ → สภาพดี</span>
              <input
                type="number"
                min={0}
                max={maxQty}
                value={repairedQty}
                onChange={(e) => setRepairedQty(e.target.value)}
                className="mt-0.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-500">ซ่อมไม่ได้ → เสีย</span>
              <input
                type="number"
                min={0}
                max={maxQty}
                value={damagedQty}
                onChange={(e) => setDamagedQty(e.target.value)}
                className="mt-0.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
              />
            </label>
            {repairTotal > maxQty && (
              <p className="text-xs text-rose-600">
                รวม {repairTotal} เกินยอดรอซ่อม {maxQty}
              </p>
            )}
          </div>
        ) : (
          <label className="mt-4 block">
            <span className="text-xs font-medium text-slate-600">จำนวน (สูงสุด {maxQty})</span>
            <input
              type="number"
              min={1}
              max={maxQty}
              value={woQty}
              onChange={(e) => setWoQty(e.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
            />
          </label>
        )}

        <label className="mt-3 block">
          <span className="text-xs font-medium text-slate-600">หมายเหตุ {isRepair ? "(ไม่บังคับ)" : "(บังคับ)"}</span>
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={isRepair ? "เช่น เปลี่ยนไม้ 2 แผ่น" : "ระบุเหตุผลการตัดจำหน่าย"}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          />
        </label>

        {err && <p className="mt-3 rounded-lg bg-rose-50 p-2 text-xs text-rose-700">{err}</p>}

        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onClose} className="h-10 flex-1 rounded-lg border border-slate-200 text-sm text-slate-700">
            ยกเลิก
          </button>
          <button
            disabled={!canSubmit}
            onClick={submit}
            className={`h-10 flex-1 rounded-lg text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 ${isRepair ? "bg-amber-600" : "bg-rose-600"}`}
          >
            {busy ? "กำลังบันทึก..." : isRepair ? "ยืนยันผลซ่อม" : "ยืนยันตัดจำหน่าย"}
          </button>
        </div>
      </div>
    </div>
  );
}
