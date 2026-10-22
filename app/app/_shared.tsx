"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

export function LiffTopBar({ title, backHref }: { title: string; backHref?: string }) {
  const router = useRouter();
  function onBack() {
    if (backHref) {
      router.replace(backHref);
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/app");
    }
  }
  return (
    <div className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-white/95 px-4 backdrop-blur">
      <button onClick={onBack} aria-label="กลับ" className="grid h-9 w-9 place-items-center rounded-full text-slate-600 hover:bg-slate-100">
        ‹
      </button>
      <h1 className="flex-1 text-base font-semibold text-slate-900">{title}</h1>
    </div>
  );
}

export function LiffEmpty({ title, subtitle, cta }: { title: string; subtitle?: string; cta?: { href: string; label: string } }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-full bg-slate-100 text-2xl text-slate-400">📭</div>
      <p className="mt-4 text-sm font-semibold text-slate-800">{title}</p>
      {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
      {cta && (
        <Link href={cta.href} className="mt-4 rounded-full bg-brand-600 px-5 py-2 text-sm font-medium text-white shadow-sm shadow-brand-600/30">
          {cta.label}
        </Link>
      )}
    </div>
  );
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  PENDING_DEPT: { label: "รออนุมัติแผนก", cls: "bg-amber-50 text-amber-700 border border-amber-200" },
  PENDING_WAREHOUSE: { label: "รอคลังพาเลท", cls: "bg-sky-50 text-sky-700 border border-sky-200" },
  COMPLETED: { label: "อนุมัติ", cls: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
  REJECTED: { label: "ปฏิเสธ", cls: "bg-rose-50 text-rose-700 border border-rose-200" },
  CANCELLED: { label: "ยกเลิก", cls: "bg-slate-100 text-slate-500 border border-slate-200" }
};

export function StatusPill({ status }: { status: string }) {
  const meta = STATUS_META[status];
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${meta?.cls ?? "bg-slate-100 text-slate-600"}`}>
      {meta?.label ?? status}
    </span>
  );
}

export const TYPE_LABEL: Record<string, string> = {
  ISSUE: "เบิกออก",
  RETURN: "คืนเข้า",
  SHIP_CUSTOMER: "ส่งลูกค้า",
  RETURN_CUSTOMER: "รับคืนจากลูกค้า",
  SEND_REPAIR: "ส่งซ่อม",
  RECEIVE_REPAIR: "รับคืนจากซ่อม",
  WRITE_OFF: "ตัดจำหน่าย",
  ADJUSTMENT: "ปรับยอด"
};

export const CONDITION_LABEL: Record<string, string> = {
  GOOD: "ดี",
  PENDING_REPAIR: "ส่งซ่อม",
  DAMAGED: "เสีย"
};

export const RETURN_SOURCE_LABEL: Record<string, string> = {
  INTERNAL: "ใช้ภายใน",
  CUSTOMER: "ลูกค้า"
};

export interface RequestCardItem {
  id: string;
  palletType: { name: string };
  quantity: number;
}

export interface RequestCardData {
  id: string;
  docNo: string;
  type: string;
  status: string;
  condition?: string | null;
  returnSource?: string | null;
  createdAt: string;
  fromDepartment?: { name: string } | null;
  toDepartment?: { name: string } | null;
  items: RequestCardItem[];
}

const TYPE_ACCENT: Record<string, { bar: string; badge: string }> = {
  ISSUE: { bar: "bg-orange-500", badge: "bg-orange-50 text-orange-700 border border-orange-200" },
  RETURN: { bar: "bg-blue-500", badge: "bg-blue-50 text-blue-700 border border-blue-200" }
};

export function RequestCard({ r, trailing, onClick }: { r: RequestCardData; trailing?: React.ReactNode; onClick?: () => void }) {
  const accent = TYPE_ACCENT[r.type] ?? { bar: "bg-slate-300", badge: "bg-slate-100 text-slate-600 border border-slate-200" };

  const content = (
    <div className="flex min-w-0 flex-1 flex-col gap-2.5">
      {/* Row 1: type badge + condition + docNo + status */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${accent.badge}`}>{TYPE_LABEL[r.type] ?? r.type}</span>
          {r.condition && r.condition !== "GOOD" && (
            <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 border border-amber-200">
              {CONDITION_LABEL[r.condition] ?? r.condition}
            </span>
          )}
          {r.type === "RETURN" && (
            <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700 border border-indigo-200">
              {RETURN_SOURCE_LABEL[r.returnSource ?? "INTERNAL"]}
            </span>
          )}
          <span className="truncate font-mono text-[11px] text-slate-400">{r.docNo}</span>
        </div>
        <StatusPill status={r.status} />
      </div>

      {/* Row 2: items */}
      {r.items.length > 0 && (
        <ul className="space-y-1">
          {r.items.map((it) => (
            <li key={it.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5">
              <span className="truncate text-xs font-medium text-slate-700">{it.palletType.name}</span>
              <span className="font-mono text-xs font-semibold text-slate-800 ml-2 shrink-0">× {it.quantity}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Row 3: date + trailing */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-slate-400">
          {new Date(r.createdAt).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}
        </p>
      </div>
      {trailing}
    </div>
  );

  const base =
    "flex w-full overflow-hidden rounded-2xl border border-border bg-white text-left shadow-sm transition active:scale-[0.99] active:bg-slate-50";
  const inner = "flex min-w-0 flex-1 flex-col p-4";
  const bar = <div className={`w-1 shrink-0 ${accent.bar}`} />;

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={base}>
        {bar}
        <div className={inner}>{content}</div>
      </button>
    );
  }
  return (
    <div className={base}>
      {bar}
      <div className={inner}>{content}</div>
    </div>
  );
}
