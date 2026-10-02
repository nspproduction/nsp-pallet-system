// Types
import type { ReactNode } from "react";

// Library
import { twMerge } from "tailwind-merge";

export function Skeleton({ className }: { className?: string }) {
  return <div className={twMerge("animate-pulse rounded-md bg-slate-200/70", className)} />;
}

export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={twMerge("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={twMerge("h-3", i === lines - 1 ? "w-3/5" : "w-full")}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={twMerge("rounded-2xl border border-border bg-white p-4", className)}>
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-2/5" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonRow({ cols = 4 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-3 w-full" />
        </td>
      ))}
    </tr>
  );
}


export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-border bg-white p-6 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    DRAFT: "bg-slate-100 text-slate-700",
    PENDING: "bg-amber-100 text-amber-800",
    APPROVED: "bg-brand-100 text-brand-800",
    FULFILLED: "bg-emerald-100 text-emerald-800",
    REJECTED: "bg-rose-100 text-rose-800",
    CANCELLED: "bg-slate-200 text-slate-600",
    ACTIVE: "bg-emerald-100 text-emerald-800",
    DISABLED: "bg-rose-100 text-rose-800",
    USABLE: "bg-emerald-100 text-emerald-800",
    IN_REPAIR: "bg-amber-100 text-amber-800",
    UNUSABLE: "bg-rose-100 text-rose-800",
  };
  const cls = map[status] ?? "bg-slate-100 text-slate-700";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {status}
    </span>
  );
}

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-10 text-center">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
    </div>
  );
}

export function Table({
  head,
  children,
}: {
  head: ReactNode[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="min-w-full divide-y divide-slate-100 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {head.map((h, i) => (
              <th
                key={i}
                className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-500"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">{children}</tbody>
      </table>
    </div>
  );
}
