"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

export function LiffTopBar({ title, backHref }: { title: string; backHref?: string }) {
  const router = useRouter();
  function onBack() {
    if (backHref) {
      router.push(backHref);
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/liff");
    }
  }
  return (
    <div className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-white/95 px-4 backdrop-blur">
      <button
        onClick={onBack}
        aria-label="กลับ"
        className="grid h-9 w-9 place-items-center rounded-full text-slate-600 hover:bg-slate-100"
      >
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

const STATUS_TONES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-rose-100 text-rose-800",
  CANCELLED: "bg-slate-200 text-slate-600",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_TONES[status] ?? "bg-slate-100"}`}>
      {status}
    </span>
  );
}

export const TYPE_LABEL: Record<string, string> = {
  RECEIVE_NEW: "รับเข้าใหม่",
  ISSUE_INTERNAL: "เบิกออก",
  RETURN_INTERNAL: "คืนเข้า",
  SHIP_CUSTOMER: "ส่งลูกค้า",
  RETURN_CUSTOMER: "รับคืนจากลูกค้า",
  SEND_REPAIR: "ส่งซ่อม",
  RECEIVE_REPAIR: "รับคืนจากซ่อม",
  WRITE_OFF: "ตัดจำหน่าย",
  ADJUSTMENT: "ปรับยอด",
};

export const CONDITION_LABEL: Record<string, string> = {
  USABLE: "ดี",
  IN_REPAIR: "ส่งซ่อม",
  UNUSABLE: "เสีย",
};

export interface RequestCardItem {
  id: string;
  palletType: { name: string };
  condition: string;
  quantity: number;
}

export interface RequestCardData {
  id: string;
  docNo: string;
  type: string;
  status: string;
  createdAt: string;
  fromDepartment?: { name: string } | null;
  toDepartment?: { name: string } | null;
  items: RequestCardItem[];
}

export function RequestCard({
  r,
  trailing,
  onClick,
}: {
  r: RequestCardData;
  trailing?: React.ReactNode;
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs text-slate-500">{r.docNo}</p>
          <p className="mt-0.5 text-sm font-semibold text-slate-900">
            {TYPE_LABEL[r.type] ?? r.type}
          </p>
        </div>
        <StatusPill status={r.status} />
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {r.fromDepartment?.name ?? "-"} → {r.toDepartment?.name ?? "-"}
      </p>
      <p className="mt-0.5 text-[11px] text-slate-400">
        {new Date(r.createdAt).toLocaleDateString("th-TH")}
      </p>
      {r.items.length > 0 && (
        <ul className="mt-2 space-y-1">
          {r.items.map((it) => (
            <li
              key={it.id}
              className="flex items-center justify-between rounded bg-slate-50 px-2 py-1 text-xs"
            >
              <span className="truncate text-slate-800">{it.palletType.name}</span>
              <span className="ml-2 flex shrink-0 items-center gap-2">
                <span className="font-mono text-slate-900">× {it.quantity}</span>
                <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] text-slate-500">
                  {CONDITION_LABEL[it.condition] ?? it.condition}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {trailing}
    </>
  );

  const base = "block w-full rounded-2xl border border-border bg-white p-4 text-left transition active:scale-[0.99] active:bg-slate-50";
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={base}>
        {content}
      </button>
    );
  }
  return <div className={base}>{content}</div>;
}
