"use client";

import { twMerge } from "tailwind-merge";
import { Mode, MODE_LABEL, MODE_ACTIVE } from "./_types";

export function ModeTabs({ modes, active, onChange }: { modes: Mode[]; active: Mode; onChange: (m: Mode) => void }) {
  return (
    <div className="flex gap-2 rounded-xl bg-slate-100 p-1">
      {modes.map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={twMerge("flex-1 rounded-lg py-2.5 text-sm font-semibold transition", active === m ? MODE_ACTIVE[m] : "text-slate-600")}
        >
          {MODE_LABEL[m]}
        </button>
      ))}
    </div>
  );
}
