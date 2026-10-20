"use client";

import { twMerge } from "tailwind-merge";
import { Palette, INPUT_BASE } from "./_types";

export function MetaFields({
  neededDate,
  purpose,
  onDateChange,
  onPurposeChange,
  palette
}: {
  neededDate: string;
  purpose: string;
  onDateChange: (v: string) => void;
  onPurposeChange: (v: string) => void;
  palette: Palette;
}) {
  return (
    <div className={twMerge("space-y-4 rounded-2xl border bg-white p-4", palette.border)}>
      <label className="block">
        <span className="text-xs font-medium text-slate-600">วันที่ต้องการ</span>
        <input
          type="date"
          value={neededDate}
          min={new Date().toLocaleDateString("sv-SE")}
          onChange={(e) => onDateChange(e.target.value)}
          className={twMerge(INPUT_BASE, "mt-1", palette.focusBorder)}
        />
      </label>

      <label className="block">
        <span className="text-xs font-medium text-slate-600">วัตถุประสงค์ / เหตุผล</span>
        <textarea
          value={purpose}
          onChange={(e) => onPurposeChange(e.target.value)}
          rows={3}
          className={twMerge("mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none", palette.focusBorder)}
        />
      </label>
    </div>
  );
}
