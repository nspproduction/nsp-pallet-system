"use client";

// Library
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { twMerge } from "tailwind-merge";

interface User {
  id: string;
  fullName: string;
  employeeCode: string;
  role: string;
  status: string;
  departmentId: string | null;
  sectionId: string | null;
  phone: string | null;
}
interface Department { id: string; code: string; name: string; }
interface Section { id: string; code: string; name: string; active: boolean; }

const inputCls = "w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-brand-500 focus:outline-none";
const ROLES = ["REQUESTER", "APPROVER", "ADMIN", "VIEWER"];
const STATUSES = ["PENDING", "ACTIVE", "DISABLED"];

export function UserEdit({ initial, departments }: { initial: User; departments: Department[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [selectedDeptId, setSelectedDeptId] = useState<string>(initial.departmentId ?? "");
  const [selectedSectionId, setSelectedSectionId] = useState<string>(initial.sectionId ?? "");
  const [sections, setSections] = useState<Section[]>([]);

  useEffect(() => {
    if (!open) return;
    if (!selectedDeptId) {
      setSections([]);
      return;
    }
    void (async () => {
      const res = await fetch(`/api/sections?departmentId=${selectedDeptId}`);
      if (res.ok) {
        const data = (await res.json()) as Section[];
        setSections(data.filter((s) => s.active || s.id === selectedSectionId));
      }
    })();
  }, [open, selectedDeptId, selectedSectionId]);

  useEffect(() => {
    if (selectedDeptId !== (initial.departmentId ?? "")) {
      setSelectedSectionId("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDeptId]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const fd = new FormData(e.currentTarget);
    const body = {
      fullName: String(fd.get("fullName")).trim(),
      employeeCode: String(fd.get("employeeCode")).trim(),
      role: String(fd.get("role")),
      status: String(fd.get("status")),
      departmentId: selectedDeptId || null,
      sectionId: selectedSectionId || null,
      phone: String(fd.get("phone") || "").trim() || null,
    };
    const res = await fetch(`/api/users/${initial.id}`, {
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

  async function activate() {
    if (!confirm(`อนุมัติผู้ใช้ ${initial.fullName}?`)) return;
    await fetch(`/api/users/${initial.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "ACTIVE" }),
    });
    router.refresh();
  }

  async function toggleStatus() {
    const next = initial.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
    const label = next === "ACTIVE" ? "เปิดใช้งาน" : "ปิดใช้งาน";
    if (!confirm(`${label}บัญชี ${initial.fullName}?`)) return;
    await fetch(`/api/users/${initial.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    router.refresh();
  }

  return (
    <div className="flex justify-end gap-2">
      {initial.status === "PENDING" && (
        <button onClick={activate} className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700">
          อนุมัติ
        </button>
      )}
      {initial.status !== "PENDING" && (
        <button
          onClick={toggleStatus}
          className={twMerge(
            "rounded-lg px-2.5 py-1 text-xs font-medium transition",
            initial.status === "ACTIVE"
              ? "bg-rose-50 text-rose-700 hover:bg-rose-100"
              : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
          )}
        >
          {initial.status === "ACTIVE" ? "ปิดใช้งาน" : "เปิดใช้งาน"}
        </button>
      )}
      <button onClick={() => setOpen(true)} className="text-xs font-medium text-brand-700 hover:text-brand-900">แก้ไข</button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <h3 className="text-base font-semibold text-slate-900">แก้ไขผู้ใช้</h3>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-900">✕</button>
            </div>
            <form onSubmit={submit} className="space-y-3 p-5">
              <label className="block">
                <span className="text-xs font-medium text-slate-600">ชื่อ</span>
                <input name="fullName" required defaultValue={initial.fullName} className={`mt-1 ${inputCls}`} />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-600">รหัสพนักงาน</span>
                <input name="employeeCode" required defaultValue={initial.employeeCode} className={`mt-1 ${inputCls}`} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">บทบาท</span>
                  <select name="role" defaultValue={initial.role} className={`mt-1 ${inputCls}`}>
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">สถานะ</span>
                  <select name="status" defaultValue={initial.status} className={`mt-1 ${inputCls}`}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">แผนก</span>
                  <select
                    value={selectedDeptId}
                    onChange={(e) => setSelectedDeptId(e.target.value)}
                    className={`mt-1 ${inputCls}`}
                  >
                    <option value="">-</option>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">Section</span>
                  <select
                    value={selectedSectionId}
                    onChange={(e) => setSelectedSectionId(e.target.value)}
                    disabled={sections.length === 0}
                    className={`mt-1 ${inputCls} disabled:bg-slate-50 disabled:text-slate-400`}
                  >
                    <option value="">{sections.length === 0 ? "— ไม่มี —" : "-"}</option>
                    {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-medium text-slate-600">โทร</span>
                <input name="phone" defaultValue={initial.phone ?? ""} className={`mt-1 ${inputCls}`} />
              </label>
              {err && <p className="text-xs text-rose-600">{err}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="h-9 rounded-lg border border-slate-200 px-4 text-sm">ยกเลิก</button>
                <button disabled={busy} className="h-9 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white disabled:opacity-50">
                  {busy ? "กำลังบันทึก..." : "บันทึก"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

