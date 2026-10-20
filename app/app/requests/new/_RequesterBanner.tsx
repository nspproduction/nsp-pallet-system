"use client";

import { twMerge } from "tailwind-merge";
import { Section, Palette } from "./_types";

export function RequesterBanner({
  dept,
  section,
  action,
  palette
}: {
  dept: { id: string; name: string } | null;
  section: Section | null;
  action: string;
  palette: Palette;
}) {
  if (!dept) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        บัญชีของคุณยังไม่ได้ผูกกับแผนก กรุณาติดต่อ Admin
      </div>
    );
  }
  return (
    <div className={twMerge("rounded-2xl border bg-white p-4", palette.border)}>
      <p className={twMerge("text-[11px] font-semibold uppercase tracking-wider", palette.labelText)}>{action}ในนาม</p>
      <p className="mt-1 text-base font-semibold text-slate-900">{dept.name}</p>
      {section && (
        <div className="mt-3">
          <p className="text-xs font-medium text-slate-600">Section</p>
          <p className="mt-1 text-sm text-slate-900">{section.name}</p>
        </div>
      )}
    </div>
  );
}
