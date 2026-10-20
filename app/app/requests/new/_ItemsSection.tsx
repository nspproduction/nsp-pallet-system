"use client";

import { twMerge } from "tailwind-merge";
import { Item, PalletType, Palette, INPUT_BASE } from "./_types";

function QuantityStepper({ value, onChange }: { value: number; onChange: (q: number) => void }) {
  const btn =
    "grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-xl font-bold text-slate-700 shadow-sm active:scale-95";
  return (
    <div className="flex w-full items-center justify-center gap-3">
      <button type="button" onClick={() => onChange(Math.max(1, value - 1))} className={btn}>
        −
      </button>
      <input
        type="number"
        min={1}
        value={value}
        onChange={(e) => onChange(Math.max(1, Number(e.target.value) || 1))}
        className="h-12 flex-1 rounded-xl border border-slate-200 bg-white text-center text-lg font-semibold outline-none focus:border-brand-500"
      />
      <button type="button" onClick={() => onChange(value + 1)} className={btn}>
        +
      </button>
    </div>
  );
}

export function ItemsSection({
  items,
  palletTypes,
  onUpdate,
  onAdd,
  onRemove,
  balanceByKey,
  balanceCondition,
  balanceLabel,
  enforceMax,
  palette
}: {
  items: Item[];
  palletTypes: PalletType[];
  onUpdate: (index: number, patch: Partial<Item>) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  balanceByKey: Record<string, number>;
  balanceCondition: string | null;
  balanceLabel: string | null;
  enforceMax: boolean;
  palette: Palette;
}) {
  return (
    <div className={twMerge("rounded-2xl border bg-white p-4", palette.border)}>
      <p className="text-xs font-medium text-slate-600">รายการพาเลท</p>
      <div className="mt-3 space-y-3">
        {items.map((it, i) => {
          const key = balanceCondition && it.palletTypeId ? `${it.palletTypeId}::${balanceCondition}` : null;
          const available = key ? (balanceByKey[key] ?? 0) : null;
          const showBalance = balanceLabel && it.palletTypeId;
          const exceed = enforceMax && available !== null && it.quantity > available;
          return (
            <div key={i} className={twMerge("rounded-xl p-3", palette.itemRowBg)}>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">รายการที่ {i + 1}</span>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onRemove(i)}
                    className="flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-rose-500 shadow-sm transition hover:bg-rose-50 hover:text-rose-700"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="h-3 w-3">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                    ลบ
                  </button>
                )}
              </div>
              <select
                value={it.palletTypeId}
                onChange={(e) => onUpdate(i, { palletTypeId: e.target.value })}
                className={twMerge(INPUT_BASE, palette.focusBorder)}
              >
                <option value="">- เลือกประเภทพาเลท -</option>
                {palletTypes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {showBalance && (
                <p className={twMerge("mt-1.5 text-[11px]", exceed ? "font-semibold text-rose-600" : "text-slate-500")}>
                  {balanceLabel}: {available ?? 0} ตัว
                  {exceed && ` · เกินยอดคงเหลือ`}
                </p>
              )}
              <div className="mt-3 flex items-center gap-2">
                <QuantityStepper value={it.quantity} onChange={(q) => onUpdate(i, { quantity: q })} />
                <span className="shrink-0 text-sm text-slate-500">ตัว</span>
              </div>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onAdd}
        className={twMerge(
          "mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed text-sm font-semibold transition hover:opacity-80",
          palette.border,
          palette.link
        )}
      >
        + เพิ่มรายการ
      </button>
    </div>
  );
}
