"use client";

import { twMerge } from "tailwind-merge";
import { Condition, CONDITIONS } from "./_types";

function toneActive(tone: string) {
  if (tone === "emerald") return "border-emerald-500 bg-emerald-50 text-emerald-800";
  if (tone === "amber") return "border-amber-500 bg-amber-50 text-amber-800";
  return "border-rose-500 bg-rose-50 text-rose-800";
}

export function ConditionPicker({ value, onChange }: { value: Condition; onChange: (c: Condition) => void }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-4">
      <p className="text-xs font-medium text-slate-600">
        สภาพพาเลทที่คืน <span className="text-slate-400">(1 สภาพต่อคำขอ)</span>
      </p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {CONDITIONS.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => onChange(c.value)}
            className={twMerge(
              "h-11 rounded-lg border text-sm font-semibold transition",
              value === c.value ? toneActive(c.tone) : "border-slate-200 bg-white text-slate-700"
            )}
          >
            {c.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-slate-500">หากต้องคืนหลายสภาพพร้อมกัน ให้สร้างคำขอแยกใบ</p>
    </div>
  );
}
