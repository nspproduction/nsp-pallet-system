"use client";

// Library
import { useState } from "react";
import { useRouter } from "next/navigation";
import { twMerge } from "tailwind-merge";

interface Department {
  id: string;
  code: string;
  name: string;
  active: boolean;
}

const INPUT_CLS =
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
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-900">✕</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
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
        code: String(fd.get("code")).trim(),
        name: String(fd.get("name")).trim(),
      }),
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
        + เพิ่มแผนก
      </button>
      {open && (
        <Modal title="เพิ่มแผนก" onClose={() => setOpen(false)}>
          <form onSubmit={submit} className="space-y-3">
            <label className="block">
              <span className="text-xs font-medium text-slate-600">รหัส</span>
              <input name="code" required className={twMerge(INPUT_CLS, "mt-1")} placeholder="e.g. QC" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">ชื่อ</span>
              <input name="name" required className={twMerge(INPUT_CLS, "mt-1")} placeholder="แผนกควบคุมคุณภาพ" />
            </label>
            {err && <p className="text-xs text-rose-600">{err}</p>}
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
        code: String(fd.get("code")).trim(),
        name: String(fd.get("name")).trim(),
      }),
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
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-brand-700 hover:text-brand-900"
      >
        แก้ไข
      </button>
      {open && (
        <Modal title={`แก้ไข: ${initial.code}`} onClose={() => setOpen(false)}>
          <form onSubmit={submit} className="space-y-3">
            <label className="block">
              <span className="text-xs font-medium text-slate-600">รหัส</span>
              <input name="code" required defaultValue={initial.code} className={twMerge(INPUT_CLS, "mt-1")} />
              {initial.code === "WH" && (
                <span className="mt-1 block text-[11px] text-amber-600">
                  * หากเปลี่ยนรหัส WH จะไม่สามารถใช้สิทธิ์ "รับเข้าใหม่" ได้
                </span>
              )}
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">ชื่อ</span>
              <input name="name" required defaultValue={initial.name} className={twMerge(INPUT_CLS, "mt-1")} />
            </label>
            {err && <p className="text-xs text-rose-600">{err}</p>}
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

interface Section {
  id: string;
  code: string;
  name: string;
  active: boolean;
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
  const [err, setErr] = useState<string | null>(null);
  const activeCount = sections.filter((s) => s.active).length;

  async function addSection(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/sections", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        departmentId,
        code: String(fd.get("code")).trim(),
        name: String(fd.get("name")).trim(),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErr(data.error ?? "เพิ่มไม่สำเร็จ");
      return;
    }
    (e.target as HTMLFormElement).reset();
    router.refresh();
  }

  async function toggleSection(id: string, active: boolean) {
    await fetch(`/api/sections/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active: !active }),
    });
    router.refresh();
  }

  async function renameSection(id: string, currentCode: string, currentName: string) {
    const code = prompt("รหัส section", currentCode);
    if (!code) return;
    const name = prompt("ชื่อ section", currentName);
    if (!name) return;
    await fetch(`/api/sections/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: code.trim(), name: name.trim() }),
    });
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-brand-700 hover:text-brand-900"
      >
        {activeCount > 0 ? `${activeCount} รายการ · จัดการ` : "+ เพิ่ม section"}
      </button>
      {open && (
        <Modal title={`Sections ของ ${departmentName}`} onClose={() => setOpen(false)}>
          <div className="space-y-4">
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
                      <p className="font-mono text-[11px] text-slate-500">{s.code}</p>
                    </div>
                    <button
                      onClick={() => renameSection(s.id, s.code, s.name)}
                      className="rounded-md px-2 py-1 text-xs text-brand-700 hover:bg-brand-50"
                    >
                      แก้ไข
                    </button>
                    <button
                      onClick={() => toggleSection(s.id, s.active)}
                      className={twMerge(
                        "rounded-md px-2 py-1 text-xs transition",
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
              <div className="grid grid-cols-2 gap-2">
                <input name="code" required placeholder="e.g. ALPHA" className={twMerge(INPUT_CLS, "font-mono")} />
                <input name="name" required placeholder="ไลน์ Alpha" className={INPUT_CLS} />
              </div>
              {err && <p className="text-xs text-rose-600">{err}</p>}
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

  async function toggle() {
    const action = active ? "ปิดใช้งาน" : "เปิดใช้งาน";
    if (!confirm(`${action} แผนก "${name}"?`)) return;
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
    <button
      onClick={toggle}
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
  );
}
