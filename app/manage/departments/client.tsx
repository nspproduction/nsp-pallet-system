"use client";

// Library
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog, PromptDialog } from "@/app/_components/dialogs";
import { twMerge } from "tailwind-merge";

interface Department {
  id: string;
  name: string;
  active: boolean;
  isWarehouse: boolean;
  requiresReturnSource: boolean;
}

interface Section {
  id: string;
  name: string;
  active: boolean;
}

const INPUT_CLS =
  "w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-brand-500 focus:outline-none";
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
        className="w-full max-w-sm rounded-2xl bg-white shadow-xl"
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

async function parseErrorMessage(res: Response, fallback: string): Promise<string> {
  const data = await res.json().catch(() => ({}));
  return data.error ?? fallback;
}

export function DepartmentAdd() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/departments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: String(fd.get("name")).trim(),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setErr(await parseErrorMessage(res, "สร้างไม่สำเร็จ"));
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
        + เพิ่มแผนก
      </button>
      {open && (
        <Modal title="เพิ่มแผนก" onClose={() => setOpen(false)}>
          <form onSubmit={submit} className="space-y-3">
            <label className="block">
              <span className="text-xs font-medium text-slate-600">ชื่อ</span>
              <input name="name" required className={twMerge(INPUT_CLS, "mt-1")} placeholder="แผนกควบคุมคุณภาพ" />
            </label>
            {err && <p className={ERR_CLS}>{err}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setOpen(false)} className="h-9 rounded-lg border border-slate-200 px-4 text-sm">ยกเลิก</button>
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

export function DepartmentEdit({ initial }: { initial: Department }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch(`/api/departments/${initial.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: String(fd.get("name")).trim(),
        requiresReturnSource: fd.get("requiresReturnSource") === "on",
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setErr(await parseErrorMessage(res, "บันทึกไม่สำเร็จ"));
      return;
    }
    setOpen(false);
    router.refresh();
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
          <form onSubmit={submit} className="space-y-3">
            <label className="block">
              <span className="text-xs font-medium text-slate-600">ชื่อ</span>
              <input name="name" required defaultValue={initial.name} className={twMerge(INPUT_CLS, "mt-1")} />
            </label>
            {!initial.isWarehouse && (
              <label className="flex items-start gap-2 rounded-lg border border-indigo-100 bg-indigo-50/40 px-2.5 py-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  name="requiresReturnSource"
                  defaultChecked={initial.requiresReturnSource}
                  className="mt-0.5 h-3.5 w-3.5 accent-indigo-600"
                />
                <span>
                  <span className="font-medium text-indigo-800">ระบุที่มาของพาเลทเมื่อคืน</span>
                  <span className="ml-1 text-slate-500">
                    — เมื่อผู้ใช้แผนกนี้สร้างคำขอคืน ต้องเลือกว่าเป็นพาเลทจาก &quot;ใช้ภายใน&quot; หรือ &quot;ลูกค้า&quot;
                  </span>
                </span>
              </label>
            )}
            {initial.isWarehouse && (
              <p className="rounded bg-amber-50 px-2 py-1.5 text-xs text-amber-700">
                แผนกนี้เป็นแผนกคลังพาเลทของระบบ · ไม่สามารถเปลี่ยนสถานะได้
              </p>
            )}
            {err && <p className={ERR_CLS}>{err}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setOpen(false)} className="h-9 rounded-lg border border-slate-200 px-4 text-sm">ยกเลิก</button>
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

export function SectionsManager({
  departmentId,
  departmentName,
  sections,
}: {
  departmentId: string;
  departmentName: string;
  sections: Section[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null);
  const activeCount = sections.filter((s) => s.active).length;

  async function addSection(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const res = await fetch("/api/sections", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        departmentId,
        name: String(fd.get("name")).trim(),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setErr(await parseErrorMessage(res, "เพิ่มไม่สำเร็จ"));
      return;
    }
    form.reset();
    router.refresh();
  }

  async function toggleSection(id: string, active: boolean) {
    if (rowBusy) return;
    setRowBusy(id);
    setErr(null);
    const res = await fetch(`/api/sections/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active: !active }),
    });
    setRowBusy(null);
    if (!res.ok) {
      setErr(await parseErrorMessage(res, "เปลี่ยนสถานะไม่สำเร็จ"));
      return;
    }
    router.refresh();
  }

  async function doRenameSection(id: string, name: string) {
    if (rowBusy) return;
    setRowBusy(id);
    setErr(null);
    const res = await fetch(`/api/sections/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setRowBusy(null);
    if (!res.ok) {
      setErr(await parseErrorMessage(res, "แก้ไขไม่สำเร็จ"));
      return;
    }
    router.refresh();
  }

  return (
    <>
      {renameTarget && (
        <PromptDialog
          label="ชื่อ section"
          initialValue={renameTarget.name}
          onConfirm={(name) => { doRenameSection(renameTarget.id, name); setRenameTarget(null); }}
          onCancel={() => setRenameTarget(null)}
        />
      )}
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-brand-700 hover:text-brand-900"
      >
        {activeCount > 0 ? `${activeCount} รายการ · จัดการ` : "+ เพิ่ม section"}
      </button>
      {open && (
        <Modal title={`Sections ของ ${departmentName}`} onClose={() => setOpen(false)}>
          <div className="space-y-4">
            {err && <p className={ERR_CLS}>{err}</p>}

            {sections.length === 0 ? (
              <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
                ยังไม่มี section · เพิ่มด้านล่าง
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {sections.map((s) => (
                  <li key={s.id} className="flex items-center gap-2 p-2.5">
                    <div className="flex-1">
                      <p className={twMerge("text-sm font-medium", !s.active && "text-slate-400 line-through")}>
                        {s.name}
                      </p>
                    </div>
                    <button
                      disabled={rowBusy === s.id}
                      onClick={() => setRenameTarget({ id: s.id, name: s.name })}
                      className="rounded-md px-2 py-1 text-xs text-brand-700 hover:bg-brand-50 disabled:opacity-50"
                    >
                      แก้ไข
                    </button>
                    <button
                      disabled={rowBusy === s.id}
                      onClick={() => toggleSection(s.id, s.active)}
                      className={twMerge(
                        "rounded-md px-2 py-1 text-xs transition disabled:opacity-50",
                        s.active
                          ? "bg-rose-50 text-rose-700 hover:bg-rose-100"
                          : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
                      )}
                    >
                      {s.active ? "ปิด" : "เปิด"}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <form onSubmit={addSection} className="space-y-2 rounded-lg border border-dashed border-slate-200 p-3">
              <p className="text-xs font-medium text-slate-600">เพิ่ม section ใหม่</p>
              <input name="name" required placeholder="เช่น ไลน์ Alpha" className={INPUT_CLS} />
              <button
                disabled={busy}
                className="h-9 w-full rounded-lg bg-brand-600 text-sm font-medium text-white disabled:opacity-50"
              >
                {busy ? "กำลังเพิ่ม..." : "+ เพิ่ม"}
              </button>
            </form>
          </div>
        </Modal>
      )}
    </>
  );
}

export function DepartmentToggle({ id, active, name }: { id: string; active: boolean; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const action = active ? "ปิดใช้งาน" : "เปิดใช้งาน";

  async function doToggle() {
    setBusy(true);
    await fetch(`/api/departments/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active: !active }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <>
      {showConfirm && (
        <ConfirmDialog
          message={`${action} แผนก "${name}"?`}
          confirmLabel={action}
          danger={active}
          onConfirm={() => { setShowConfirm(false); doToggle(); }}
          onCancel={() => setShowConfirm(false)}
        />
      )}
      <button
        onClick={() => setShowConfirm(true)}
        disabled={busy}
        className={twMerge(
          "rounded-lg px-2.5 py-1 text-xs font-medium transition disabled:opacity-50",
          active
            ? "bg-rose-50 text-rose-700 hover:bg-rose-100"
            : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
        )}
      >
        {active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
      </button>
    </>
  );
}
