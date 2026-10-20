"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface PalletType {
  id: string;
  name: string;
  sizeSpec: string | null;
  active: boolean;
}

interface FormValues {
  name: string;
  sizeSpec: string | null;
  active: boolean;
}

const inputCls =
  "w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-brand-500 focus:outline-none";

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  // Close on ESC
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

function PalletTypeForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  initial?: PalletType;
  onSubmit: (values: FormValues) => Promise<string | null>;
  onCancel: () => void;
  submitLabel: string;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const fd = new FormData(e.currentTarget);
    const values: FormValues = {
      name: String(fd.get("name") ?? "").trim(),
      sizeSpec: String(fd.get("sizeSpec") ?? "").trim() || null,
      active: fd.get("active") === "on",
    };
    const errMsg = await onSubmit(values);
    setBusy(false);
    if (errMsg) setErr(errMsg);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="ชื่อ">
        <input name="name" required defaultValue={initial?.name ?? ""} className={inputCls} />
      </Field>
      <Field label="ขนาด">
        <input
          name="sizeSpec"
          defaultValue={initial?.sizeSpec ?? ""}
          placeholder="100x120x15"
          className={inputCls}
        />
      </Field>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          name="active"
          defaultChecked={initial?.active ?? true}
          className="h-4 w-4 rounded border-slate-300"
        />
        เปิดใช้งาน
      </label>
      {err && <p className="rounded bg-rose-50 px-2 py-1.5 text-xs text-rose-700">{err}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-9 rounded-lg border border-slate-200 px-4 text-sm"
        >
          ยกเลิก
        </button>
        <button
          disabled={busy}
          className="h-9 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? "กำลังบันทึก..." : submitLabel}
        </button>
      </div>
    </form>
  );
}

async function parseErrorMessage(res: Response, fallback: string): Promise<string> {
  const data = await res.json().catch(() => ({}));
  return data.error ?? fallback;
}

export function PalletTypeAdd() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function submit(values: FormValues): Promise<string | null> {
    const res = await fetch("/api/pallet-types", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      return parseErrorMessage(res, "สร้างไม่สำเร็จ");
    }
    setOpen(false);
    router.refresh();
    return null;
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
          <PalletTypeForm
            onSubmit={submit}
            onCancel={() => setOpen(false)}
            submitLabel="บันทึก"
          />
        </Modal>
      )}
    </>
  );
}

export function PalletTypeEdit({ initial }: { initial: PalletType }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function submit(values: FormValues): Promise<string | null> {
    const res = await fetch(`/api/pallet-types/${initial.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      return await parseErrorMessage(res, "บันทึกไม่สำเร็จ");
    }
    setOpen(false);
    router.refresh();
    return null;
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-brand-700 hover:text-brand-900"
      >
        แก้ไข
      </button>
      {open && (
        <Modal title={`แก้ไข: ${initial.name}`} onClose={() => setOpen(false)}>
          <PalletTypeForm
            initial={initial}
            onSubmit={submit}
            onCancel={() => setOpen(false)}
            submitLabel="บันทึก"
          />
        </Modal>
      )}
    </>
  );
}
