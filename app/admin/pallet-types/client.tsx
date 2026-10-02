"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface PalletType {
  id: string;
  code: string;
  name: string;
  material: string | null;
  sizeSpec: string | null;
  minStock: number;
  active: boolean;
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-900">✕</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

const inputCls = "w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-brand-500 focus:outline-none";

export function PalletTypeAdd() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const fd = new FormData(e.currentTarget);
    const body = {
      code: String(fd.get("code")).trim(),
      name: String(fd.get("name")).trim(),
      material: String(fd.get("material") || "").trim() || null,
      sizeSpec: String(fd.get("sizeSpec") || "").trim() || null,
      minStock: Number(fd.get("minStock") || 0),
    };
    const res = await fetch("/api/pallet-types", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErr(data.error ?? "สร้างไม่สำเร็จ");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-600 px-3.5 text-sm font-medium text-white shadow-sm shadow-brand-600/30 hover:bg-brand-700"
      >
        + เพิ่มประเภท
      </button>
      {open && (
        <Modal title="เพิ่มประเภทพาเลท" onClose={() => setOpen(false)}>
          <form onSubmit={submit} className="space-y-4">
            <Field label="รหัส (code)"><input name="code" required className={inputCls} placeholder="e.g. WOOD-STD" /></Field>
            <Field label="ชื่อ"><input name="name" required className={inputCls} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="วัสดุ"><input name="material" className={inputCls} placeholder="ไม้ / พลาสติก / เหล็ก" /></Field>
              <Field label="ขนาด"><input name="sizeSpec" className={inputCls} placeholder="100x120x15" /></Field>
            </div>
            <Field label="Min Stock"><input type="number" name="minStock" defaultValue={0} min={0} className={inputCls} /></Field>
            {err && <p className="text-xs text-rose-600">{err}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setOpen(false)} className="h-9 rounded-lg border border-slate-200 px-4 text-sm">
                ยกเลิก
              </button>
              <button disabled={busy} className="h-9 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white disabled:opacity-50">
                {busy ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

export function PalletTypeEdit({ initial }: { initial: PalletType }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const fd = new FormData(e.currentTarget);
    const body = {
      code: String(fd.get("code")).trim(),
      name: String(fd.get("name")).trim(),
      material: String(fd.get("material") || "").trim() || null,
      sizeSpec: String(fd.get("sizeSpec") || "").trim() || null,
      minStock: Number(fd.get("minStock") || 0),
      active: fd.get("active") === "on",
    };
    const res = await fetch(`/api/pallet-types/${initial.id}`, {
      method: "PATCH",
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
    router.refresh();
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="text-xs font-medium text-brand-700 hover:text-brand-900">
        แก้ไข
      </button>
      {open && (
        <Modal title={`แก้ไข: ${initial.code}`} onClose={() => setOpen(false)}>
          <form onSubmit={submit} className="space-y-4">
            <Field label="รหัส (code)"><input name="code" required defaultValue={initial.code} className={inputCls} /></Field>
            <Field label="ชื่อ"><input name="name" required defaultValue={initial.name} className={inputCls} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="วัสดุ"><input name="material" defaultValue={initial.material ?? ""} className={inputCls} /></Field>
              <Field label="ขนาด"><input name="sizeSpec" defaultValue={initial.sizeSpec ?? ""} className={inputCls} /></Field>
            </div>
            <Field label="Min Stock"><input type="number" name="minStock" defaultValue={initial.minStock} min={0} className={inputCls} /></Field>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="active" defaultChecked={initial.active} className="h-4 w-4 rounded border-slate-300" />
              เปิดใช้งาน
            </label>
            {err && <p className="text-xs text-rose-600">{err}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setOpen(false)} className="h-9 rounded-lg border border-slate-200 px-4 text-sm">
                ยกเลิก
              </button>
              <button disabled={busy} className="h-9 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white disabled:opacity-50">
                {busy ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

