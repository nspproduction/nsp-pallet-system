import { Skeleton } from "@/app/_components/ui";

export function LiffTopBarSkeleton({ title }: { title: string }) {
  return (
    <div className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-white/95 px-4 backdrop-blur">
      <div className="grid h-9 w-9 place-items-center text-slate-300">‹</div>
      <h1 className="flex-1 text-base font-semibold text-slate-900">{title}</h1>
    </div>
  );
}

export function CardListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <ul className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="space-y-2 rounded-2xl border border-border bg-white p-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1.5">
              <Skeleton className="h-2.5 w-24" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-4 w-16 rounded-full" />
          </div>
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-3 w-2/5" />
          <div className="mt-2 space-y-1.5">
            <Skeleton className="h-6 w-full rounded" />
            <Skeleton className="h-6 w-full rounded" />
          </div>
        </li>
      ))}
    </ul>
  );
}
