"use client";

import { useEffect, useState } from "react";
import { twMerge } from "tailwind-merge";
import { ConfirmDialog } from "@/app/_components/dialogs";

interface Department { id: string; name: string }
interface Approver { id: string; fullName: string; departmentId: string | null }
interface StepData { stepOrder: number; name: string; approverIds: string[] }
interface RouteData {
  id: string;
  departmentId: string;
  requestType: string;
  isActive: boolean;
  department: Department;
  steps: StepData[];
}

const TYPE_LABEL: Record<string, string> = {
  ISSUE: "เบิกออก",
  RETURN: "คืนเข้า",
};

export function ApprovalRoutesClient({
  routes: initial,
  departments,
  approvers,
}: {
  routes: RouteData[];
  departments: Department[];
  approvers: Approver[];
}) {
  const [routes, setRoutes] = useState<RouteData[]>(initial);
  const [editing, setEditing] = useState<RouteData | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [listErr, setListErr] = useState<string | null>(null);

  async function reload() {
    try {
      const res = await fetch("/api/approval-routes");
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setListErr(payload.error ?? "โหลดข้อมูลไม่สำเร็จ");
        return;
      }
      setRoutes(await res.json());
      setListErr(null);
    } catch {
      setListErr("โหลดข้อมูลไม่สำเร็จ");
    }
  }

  async function save(data: { id?: string; departmentId: string; requestType: string; steps: StepData[] }): Promise<string | null> {
    const res = await fetch("/api/approval-routes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      return payload.error ?? "บันทึกไม่สำเร็จ";
    }
    setShowForm(false);
    setEditing(null);
    await reload();
    return null;
  }

  async function remove(id: string) {
    try {
      const res = await fetch(`/api/approval-routes/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setListErr(payload.error ?? "ลบไม่สำเร็จ");
        return;
      }
      await reload();
    } catch {
      setListErr("ลบไม่สำเร็จ");
    }
  }

  return (
    <>
    {confirmDelete && (
      <ConfirmDialog
        message="ต้องการลบ approval route นี้?"
        confirmLabel="ลบ"
        danger
        onConfirm={() => { remove(confirmDelete); setConfirmDelete(null); }}
        onCancel={() => setConfirmDelete(null)}
      />
    )}
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="h-9 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
        >
          + เพิ่ม Route
        </button>
      </div>

      {listErr && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{listErr}</p>
      )}

      {routes.length === 0 && !listErr && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm text-slate-500">
          ยังไม่มี approval route — กด &quot;+ เพิ่ม Route&quot; เพื่อเริ่มต้น
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {routes.map((r) => (
          <div key={r.id} className="rounded-2xl border border-border bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="mt-0.5 font-semibold text-slate-900">{r.department.name}</p>
                <span className="mt-1 inline-block rounded-full bg-brand-100 px-2.5 py-0.5 text-[11px] font-medium text-brand-700">
                  {TYPE_LABEL[r.requestType] ?? r.requestType}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setEditing(r); setShowForm(true); }}
                  className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
                >
                  แก้ไข
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(r.id)}
                  className="rounded-lg border border-rose-200 px-2.5 py-1 text-xs text-rose-600 hover:bg-rose-50"
                >
                  ลบ
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {r.steps.map((s) => (
                <div key={s.stepOrder} className="flex items-start gap-3 rounded-lg bg-slate-50 px-3 py-2">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
                    {s.stepOrder}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800">{s.name}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {s.approverIds.length} คน ·{" "}
                      {s.approverIds
                        .map((id) => approvers.find((a) => a.id === id)?.fullName ?? "⚠ ผู้ใช้ไม่พร้อม")
                        .join(", ")}
                    </p>
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-3 rounded-lg border border-dashed border-slate-200 px-3 py-2">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-500">
                  {r.steps.length + 1}
                </span>
                <p className="text-sm text-slate-400">คลังพาเลท (ขั้นสุดท้าย — อัตโนมัติ)</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <RouteFormModal
          initial={editing}
          departments={departments}
          approvers={approvers}
          existingRoutes={routes}
          onSave={save}
          onClose={() => { setShowForm(false); setEditing(null); }}
        />
      )}
    </div>
    </>
  );
}

// -----------------------------------------------------------------------
// Route form modal
// -----------------------------------------------------------------------

const ALL_TYPES = ["ISSUE", "RETURN"] as const;

function RouteFormModal({
  initial,
  departments,
  approvers,
  existingRoutes,
  onSave,
  onClose,
}: {
  initial: RouteData | null;
  departments: Department[];
  approvers: Approver[];
  existingRoutes: RouteData[];
  onSave: (data: { id?: string; departmentId: string; requestType: string; steps: StepData[] }) => Promise<string | null>;
  onClose: () => void;
}) {
  const isEdit = initial !== null;

  // Compute which (dept, type) combos are already occupied (excluding the one
  // currently being edited). An active route pair blocks creating/moving into it.
  function takenTypesFor(deptId: string): Set<string> {
    return new Set(
      existingRoutes
        .filter((r) => r.departmentId === deptId && r.id !== initial?.id)
        .map((r) => r.requestType),
    );
  }

  // Departments that still have at least one available type (for create mode)
  const deptsWithRoom = departments.filter((d) => takenTypesFor(d.id).size < ALL_TYPES.length);

  // Initial department: in create mode, pick the first dept with room
  const [departmentId, setDepartmentId] = useState<string>(
    initial?.departmentId ?? deptsWithRoom[0]?.id ?? "",
  );
  const taken = takenTypesFor(departmentId);
  const availableTypes = ALL_TYPES.filter((t) => !taken.has(t));

  const [requestType, setRequestType] = useState<string>(
    initial?.requestType ?? availableTypes[0] ?? "ISSUE",
  );

  // When department changes (create mode only), reset type to a valid one.
  // Uses "adjust state while rendering" pattern.
  const [prevDeptId, setPrevDeptId] = useState(departmentId);
  if (!isEdit && departmentId !== prevDeptId) {
    setPrevDeptId(departmentId);
    const nextTaken = takenTypesFor(departmentId);
    const nextAvailable = ALL_TYPES.filter((t) => !nextTaken.has(t));
    if (!nextAvailable.includes(requestType as (typeof ALL_TYPES)[number])) {
      setRequestType(nextAvailable[0] ?? "");
    }
  }

  const [steps, setSteps] = useState<StepData[]>(
    initial?.steps.length
      ? initial.steps
      : [{ stepOrder: 1, name: "หัวหน้าแผนก", approverIds: [] }],
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Close on ESC
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSave() {
    setBusy(true);
    setErr(null);
    const errMsg = await onSave({
      id: initial?.id,
      departmentId,
      requestType,
      steps,
    });
    setBusy(false);
    if (errMsg) setErr(errMsg);
  }

  function addStep() {
    setSteps([...steps, { stepOrder: steps.length + 1, name: "", approverIds: [] }]);
  }
  function removeStep(i: number) {
    const next = steps.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, stepOrder: idx + 1 }));
    setSteps(next);
  }
  function updateStep(i: number, patch: Partial<StepData>) {
    setSteps(steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function toggleApprover(stepIdx: number, userId: string) {
    const step = steps[stepIdx];
    const next = step.approverIds.includes(userId)
      ? step.approverIds.filter((id) => id !== userId)
      : [...step.approverIds, userId];
    updateStep(stepIdx, { approverIds: next });
  }

  // Show approvers that match the selected dept + anyone already assigned to a step
  // (so admin can un-assign them if their dept was changed after assignment).
  const assignedIds = new Set(steps.flatMap((s) => s.approverIds));
  const deptApprovers = approvers.filter(
    (a) => a.departmentId === departmentId || assignedIds.has(a.id),
  );
  const INPUT = "h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-brand-500";

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 md:items-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg rounded-2xl bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-semibold text-slate-900">{initial ? "แก้ไข Route" : "เพิ่ม Route ใหม่"}</h2>
          <button type="button" onClick={onClose} aria-label="ปิด" className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto p-5">
          <label className="block">
            <span className="text-xs font-medium text-slate-600">
              แผนก{isEdit && <span className="ml-1 text-[10px] text-slate-400">(ล็อก — แก้ไขไม่ได้)</span>}
            </span>
            <select
              value={departmentId}
              disabled={isEdit}
              onChange={(e) => {
                setDepartmentId(e.target.value);
                setSteps((prev) => prev.map((s) => ({ ...s, approverIds: [] })));
              }}
              className={twMerge(INPUT, "mt-1", "disabled:bg-slate-50 disabled:text-slate-500")}
            >
              {!isEdit && <option value="">- เลือกแผนก -</option>}
              {departments.map((d) => {
                const deptTaken = takenTypesFor(d.id).size;
                const full = deptTaken >= ALL_TYPES.length;
                return (
                  <option key={d.id} value={d.id} disabled={!isEdit && full}>
                    {d.name}{!isEdit && full ? " (สร้างครบแล้ว)" : ""}
                  </option>
                );
              })}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-slate-600">
              ประเภทคำขอ{isEdit && <span className="ml-1 text-[10px] text-slate-400">(ล็อก — แก้ไขไม่ได้)</span>}
            </span>
            <select
              value={requestType}
              disabled={isEdit}
              onChange={(e) => setRequestType(e.target.value)}
              className={twMerge(INPUT, "mt-1", "disabled:bg-slate-50 disabled:text-slate-500")}
            >
              {isEdit ? (
                <option value={requestType}>{TYPE_LABEL[requestType] ?? requestType}</option>
              ) : (
                <>
                  {availableTypes.length === 0 && <option value="">- ไม่มีประเภทที่สร้างได้ -</option>}
                  {availableTypes.map((t) => (
                    <option key={t} value={t}>{TYPE_LABEL[t] ?? t}</option>
                  ))}
                </>
              )}
            </select>
            {!isEdit && availableTypes.length === 0 && departmentId && (
              <p className="mt-1 text-[11px] text-amber-600">
                แผนกนี้มี route ครบทั้ง 2 ประเภทแล้ว — ต้องลบ route เดิมก่อนจึงจะสร้างใหม่ได้
              </p>
            )}
          </label>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-slate-600">ขั้นการอนุมัติ</p>
              <button
                type="button"
                onClick={addStep}
                disabled={steps.length >= 10}
                className="text-xs font-semibold text-brand-700 disabled:text-slate-400"
              >
                + เพิ่มขั้น
              </button>
            </div>

            {steps.map((step, i) => (
              <div key={i} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                <div className="flex items-center gap-2">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-600 text-xs font-bold text-white">
                    {step.stepOrder}
                  </span>
                  <input
                    value={step.name}
                    onChange={(e) => updateStep(i, { name: e.target.value })}
                    placeholder="ชื่อขั้น เช่น หัวหน้าแผนก"
                    className="h-8 flex-1 rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:border-brand-500"
                  />
                  {steps.length > 1 && (
                    <button type="button" onClick={() => removeStep(i)} className="text-xs text-rose-500">ลบ</button>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">ผู้อนุมัติ (เลือกได้หลายคน — ใครก็ได้ 1 คนอนุมัติผ่าน)</p>
                <div className="flex flex-wrap gap-2">
                  {!departmentId && (
                    <p className="text-[11px] text-slate-400">เลือกแผนกก่อนเพื่อดูรายชื่อผู้อนุมัติ</p>
                  )}
                  {departmentId && deptApprovers.length === 0 && (
                    <p className="text-[11px] text-amber-600">ไม่มีผู้ใช้ role DEPT_APPROVER ในแผนกนี้ — กรุณาตั้งค่า role ก่อน</p>
                  )}
                  {deptApprovers.map((a) => {
                    const selected = step.approverIds.includes(a.id);
                    const mismatchedDept = a.departmentId !== departmentId;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => toggleApprover(i, a.id)}
                        title={mismatchedDept ? "ผู้อนุมัติไม่ได้อยู่แผนกนี้แล้ว" : undefined}
                        className={twMerge(
                          "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition",
                          selected
                            ? "border-brand-500 bg-brand-50 text-brand-700"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                          mismatchedDept && "border-dashed border-amber-400 text-amber-700",
                        )}
                      >
                        {a.fullName}
                        {mismatchedDept && <span className="ml-1 text-[9px]">⚠</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-200 p-3 text-sm text-slate-400">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-400">
                {steps.length + 1}
              </span>
              คลังพาเลท (ขั้นสุดท้าย — อัตโนมัติ)
            </div>
          </div>
        </div>

        {err && (
          <p className="mx-5 mb-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{err}</p>
        )}
        <div className="flex gap-3 border-t border-border px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-10 flex-1 rounded-xl border border-slate-200 text-sm font-medium text-slate-700"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={busy || !departmentId || !requestType}
            className="h-10 flex-1 rounded-xl bg-brand-600 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </div>
    </div>
  );
}
