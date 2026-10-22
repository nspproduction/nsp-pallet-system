"use client";

// Library
import { twMerge } from "tailwind-merge";

// Types
import type { Palette, ReturnSource } from "./_types";
import { RETURN_SOURCE_LABEL } from "./_types";

interface Props {
  value: ReturnSource | null;
  onChange: (value: ReturnSource) => void;
  palette: Palette;
}

const OPTIONS: ReturnSource[] = ["INTERNAL", "CUSTOMER"];

export function ReturnSourcePicker({ value, onChange, palette }: Props) {
  return (
    <div className={twMerge("space-y-2 rounded-2xl border bg-white p-4", palette.border)}>
      <p className={twMerge("text-xs font-semibold", palette.labelText)}>ที่มาของพาเลท</p>
      <div className="grid grid-cols-2 gap-2">
        {OPTIONS.map((opt) => {
          const selected = value === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={twMerge(
                "h-11 rounded-xl border text-sm font-medium transition",
                selected
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              )}
            >
              {RETURN_SOURCE_LABEL[opt]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
