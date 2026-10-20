"use client";

// Library
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { twMerge } from "tailwind-merge";
import { ConfirmDialog } from "@/app/_components/dialogs";

interface User {
  id: string;
  fullName: string;
  email: string;
  roles: string[];
  status: string;
  departmentId: string | null;
  sectionId: string | null;
  phone: string | null;
}
interface Department { id: string; name: string; isWarehouse: boolean; }
interface Section { id: string; name: string; active: boolean; }

const inputCls = "w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-brand-500 focus:outline-none";
const ERR_CLS = "w-full rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700";

const ROLE_LABEL: Record<string, string> = {
  REQUESTER:      "ผู้ร้องขอ",
  DEPT_APPROVER:  "ผู้อนุมัติแผนก",
  VIEWER:         "ดูอย่างเดียว",
  PALLET_MANAGER: "ผู้อนุมัติพาเลท",
  ADMIN:          "ผู้ดูแลระบบ",
};
const STATUS_LABEL: Record<string, string> = {
  ACTIVE:   "ใช้งานได้",
  PENDING:  "รอการอนุมัติ",
  DISABLED: "ระงับการใช้งานชั่วคราว",
};
const WAREHOUSE_ROLES = ["PALLET_MANAGER", "ADMIN"];
const DEPT_ROLES      = ["REQUESTER", "DEPT_APPROVER", "VIEWER"];
const STATUSES = ["ACTIVE", "DISABLED"];

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

export function UserEdit({
  initial,
  departments,
  currentUserId,
}: {
  initial: User;
  departments: Department[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ message: string; onConfirm: () => Promise<boolean> } | null>(null);
  const [selectedDeptId, setSelectedDeptId] = useState<string>(initial.departmentId ?? "");
  const [selectedSectionId, setSelectedSectionId] = useState<string>(initial.sectionId ?? "");
  const [selectedRole, setSelectedRole] = useState<string>(initial.roles[0] ?? "");
  const [sections, setSections] = useState<Section[]>([]);

  // Admin cannot disable or demote themselves — mirrors the server guard.
  const isSelf = initial.id === currentUserId;

  const selectedDept = departments.find((d) => d.id === selectedDeptId) ?? null;
  const availableRoles = selectedDept
    ? selectedDept.isWarehouse ? WAREHOUSE_ROLES : DEPT_ROLES
    : [];

  // Fetch sections whenever the modal opens or the selected department changes.
  // Note: we intentionally do NOT depend on `selectedSectionId` to avoid refetching
  // every time the user picks a section from the dropdown.
  useEffect(() => {
    if (!open) return;
    if (!selectedDeptId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing on dept-cleared is a sync action
      setSections([]);
      return;
    }
    void (async () => {
      const res = await fetch(`/api/sections?departmentId=${selectedDeptId}`);
      if (res.ok) {
        const data = (await res.json()) as Section[];
        // Keep active sections + the currently assigned section (even if deactivated)
        setSections(data.filter((s) => s.active || s.id === initial.sectionId));
      }
    })();
  }, [open, selectedDeptId, initial.sectionId]);

  // When the admin switches department, reset section + default the role.
  // Uses the "adjust state while rendering" pattern (React docs) instead of useEffect.
  const [prevDeptId, setPrevDeptId] = useState<string>(initial.departmentId ?? "");
  if (selectedDeptId !== prevDeptId) {
    setPrevDeptId(selectedDeptId);
    setSelectedSectionId("");
    const dept = departments.find((d) => d.id === selectedDeptId);
    if (!dept) {
      setSelectedRole("");
    } else {
      const roles = dept.isWarehouse ? WAREHOUSE_ROLES : DEPT_ROLES;
      if (!roles.includes(selectedRole)) setSelectedRole(roles[0]);
    }
  }

  const isApprover = selectedRole === "DEPT_APPROVER";
  const sectionRequired = sections.length > 0 && !isApprover;
  const canSave = !busy && selectedDeptId && (!sectionRequired || selectedSectionId !== "");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sectionRequired && !selectedSectionId) {
      setErr("กรุณาเลือก section ให้ครบ");
      return;
    }
    setBusy(true);
    setErr(null);
    const fd = new FormData(e.currentTarget);
    // When editing self the role/status/dept controls are disabled, so FormData
    // doesn't include them. Fall back to the current values to avoid clearing fields.
    const body = {
      fullName: String(fd.get("fullName")).trim(),
      roles: isSelf ? initial.roles : (selectedRole ? [selectedRole] : []),
      status: isSelf ? initial.status : String(fd.get("status")),
      departmentId: isSelf ? initial.departmentId : (selectedDeptId || null),
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

  async function patchUser(body: object) {
    const res = await fetch(`/api/users/${initial.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErr((data as { error?: string }).error ?? "ไม่สำเร็จ");
      return false;
    }
    router.refresh();
    return true;
  }

  function activate() {
    setConfirm({
      message: `อนุมัติผู้ใช้ ${initial.fullName}? ระบบจะส่งอีเมลแจ้งผลให้ผู้ใช้`,
      onConfirm: () => patchUser({ status: "ACTIVE" }),
    });
  }

  function reject() {
    setConfirm({
      message: `ปฏิเสธบัญชี ${initial.fullName}? ระบบจะส่งอีเมลแจ้งผลให้ผู้ใช้`,
      onConfirm: () => patchUser({ status: "DISABLED" }),
    });
  }

  function toggleStatus() {
    const next = initial.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
    const label = next === "ACTIVE" ? "เปิดใช้งาน" : "ปิดใช้งาน";
    setConfirm({
      message: `${label}บัญชี ${initial.fullName}?`,
      onConfirm: () => patchUser({ status: next }),
    });
  }

  return (
    <>
      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          onConfirm={async () => { setConfirm(null); await confirm.onConfirm(); }}
          onCancel={() => setConfirm(null)}
        />
      )}
      <div className="flex flex-col items-end gap-2">
        {err && !open && <p className={ERR_CLS}>{err}</p>}
        <div className="flex justify-end gap-2">
          {initial.status === "PENDING" && (
            <>
              <button onClick={activate} className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700">
                อนุมัติ
              </button>
              <button onClick={reject} className="rounded-lg bg-rose-600 px-3 py-1 text-xs font-medium text-white hover:bg-rose-700">
                ปฏิเสธ
              </button>
            </>
          )}
          {initial.status !== "PENDING" && !isSelf && (
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
          <button onClick={() => setOpen(true)} className="text-xs font-medium text-brand-700 hover:text-brand-900">
            แก้ไข
          </button>
        </div>
      </div>

      {open && (
        <Modal title="แก้ไขผู้ใช้" onClose={() => setOpen(false)}>
          <form onSubmit={submit} className="space-y-3 p-5">
            <label className="block">
              <span className="text-xs font-medium text-slate-600">ชื่อ</span>
              <input name="fullName" required defaultValue={initial.fullName} className={`mt-1 ${inputCls}`} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">อีเมล</span>
              <input defaultValue={initial.email} readOnly className={`mt-1 ${inputCls} bg-slate-50 text-slate-500`} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-medium text-slate-600">
                  แผนก{isSelf && <span className="ml-1 text-[10px] text-slate-400">(ของตัวเอง — ล็อก)</span>}
                </span>
                <select
                  value={selectedDeptId}
                  onChange={(e) => setSelectedDeptId(e.target.value)}
                  disabled={isSelf}
                  className={`mt-1 ${inputCls} disabled:bg-slate-50 disabled:text-slate-400`}
                >
                  <option value="">- เลือกแผนก -</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.isWarehouse ? `${d.name} (คลัง)` : d.name}
                    </option>
                  ))}
                </select>
              </label>
              {isApprover ? (
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-slate-600">Section</span>
                  <p className="mt-1 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-400">ครอบคลุมทุก section</p>
                </div>
              ) : (
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">
                    Section{sectionRequired && <span className="ml-0.5 text-rose-500">*</span>}
                  </span>
                  <select
                    value={selectedSectionId}
                    onChange={(e) => setSelectedSectionId(e.target.value)}
                    disabled={sections.length === 0}
                    className={`mt-1 ${inputCls} disabled:bg-slate-50 disabled:text-slate-400 ${sectionRequired && !selectedSectionId ? "border-rose-400" : ""}`}
                  >
                    <option value="">{sections.length === 0 ? "— ไม่มี —" : "- เลือก section -"}</option>
                    {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  {sectionRequired && !selectedSectionId && (
                    <span className="mt-0.5 block text-[10px] text-rose-500">กรุณาเลือก section</span>
                  )}
                </label>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-medium text-slate-600">
                  บทบาท{isSelf && <span className="ml-1 text-[10px] text-slate-400">(ของตัวเอง — ล็อก)</span>}
                </span>
                <select
                  value={selectedRole}
                  onChange={(e) => {
                    setSelectedRole(e.target.value);
                    if (e.target.value === "DEPT_APPROVER") setSelectedSectionId("");
                  }}
                  disabled={!selectedDeptId || isSelf}
                  className={`mt-1 ${inputCls} disabled:bg-slate-50 disabled:text-slate-400`}
                >
                  {!selectedDeptId
                    ? <option value="">— เลือกแผนกก่อน —</option>
                    : availableRoles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r] ?? r}</option>)
                  }
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-600">
                  สถานะ{isSelf && <span className="ml-1 text-[10px] text-slate-400">(ของตัวเอง — ล็อก)</span>}
                </span>
                <select
                  name="status"
                  defaultValue={initial.status}
                  disabled={isSelf}
                  className={`mt-1 ${inputCls} disabled:bg-slate-50 disabled:text-slate-400`}
                >
                  {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s] ?? s}</option>)}
                </select>
              </label>
            </div>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">โทร</span>
              <input name="phone" defaultValue={initial.phone ?? ""} className={`mt-1 ${inputCls}`} />
            </label>
            {err && <p className={ERR_CLS}>{err}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setOpen(false)} className="h-9 rounded-lg border border-slate-200 px-4 text-sm">
                ยกเลิก
              </button>
              <button disabled={!canSave} className="h-9 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white disabled:opacity-50">
                {busy ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
