"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

export function LiffTopBar({ title, backHref = "/liff" }: { title: string; backHref?: string }) {
  const router = useRouter();
  return (
    <div className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-white/95 px-4 backdrop-blur">
      <button
        onClick={() => router.push(backHref)}
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
  APPROVED: "bg-brand-100 text-brand-800",
  FULFILLED: "bg-emerald-100 text-emerald-800",
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
  ISSUE_INTERNAL: "เบิกใช้ภายใน",
  RETURN_INTERNAL: "คืนจากภายใน",
  SHIP_CUSTOMER: "ส่งลูกค้า",
  RETURN_CUSTOMER: "รับคืนจากลูกค้า",
  SEND_REPAIR: "ส่งซ่อม",
  RECEIVE_REPAIR: "รับคืนจากซ่อม",
  WRITE_OFF: "ตัดจำหน่าย",
  ADJUSTMENT: "ปรับยอด",
};
