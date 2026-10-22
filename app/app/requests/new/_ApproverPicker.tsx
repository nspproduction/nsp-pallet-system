"use client";

// Library
import { twMerge } from "tailwind-merge";

// Types
import type { Palette, RouteStep } from "./_types";

interface Props {
  steps: RouteStep[];
  picks: Record<number, string>;
  onPickChange: (stepOrder: number, approverId: string) => void;
  currentUserId: string | null;
  palette: Palette;
}

// Renders a selector per route step that has requesterPicks=true and
// more than one approver. Single-approver pick steps are auto-selected
// upstream and not shown here.
export function ApproverPicker({ steps, picks, onPickChange, currentUserId, palette }: Props) {
  const pickable = steps.filter((s) => s.requesterPicks && s.approvers.length > 1);
  if (pickable.length === 0) return null;

  return (
    <div className={twMerge("space-y-3 rounded-2xl border bg-white p-4", palette.border)}>
      <p className={twMerge("text-xs font-semibold", palette.labelText)}>เลือกผู้อนุมัติ</p>
      {pickable.map((s) => {
        const selectable = s.approvers.filter((a) => a.id !== currentUserId);
        const value = picks[s.stepOrder] ?? "";
        return (
          <label key={s.stepOrder} className="block">
            <span className="text-xs font-medium text-slate-600">
              ขั้นที่ {s.stepOrder} · {s.name}
            </span>
            <select
              value={value}
              onChange={(e) => onPickChange(s.stepOrder, e.target.value)}
              className={twMerge(
                "mt-1 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-brand-500",
                !value && "text-slate-400"
              )}
            >
              <option value="">- เลือกผู้อนุมัติ -</option>
              {selectable.map((a) => (
                <option key={a.id} value={a.id}>{a.fullName}</option>
              ))}
            </select>
            {selectable.length === 0 && (
              <p className="mt-1 text-[11px] text-rose-600">
                ไม่มีผู้อนุมัติที่เลือกได้ในขั้นนี้ — กรุณาติดต่อ Admin
              </p>
            )}
          </label>
        );
      })}
    </div>
  );
}
