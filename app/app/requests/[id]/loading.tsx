import { Skeleton } from "@/app/_components/ui";
import { LiffTopBarSkeleton } from "../../_loading-shared";

export default function Loading() {
  return (
    <div>
      <LiffTopBarSkeleton title="คำขอ" />
      <div className="space-y-4 p-4">
        <div className="space-y-3 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-900 p-4 text-white">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-20 bg-white/20" />
            <Skeleton className="h-4 w-16 rounded-full bg-white/20" />
          </div>
          <Skeleton className="h-5 w-40 bg-white/20" />
        </div>
        <div className="space-y-3 rounded-2xl border border-border bg-white p-4">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="space-y-3 rounded-2xl border border-border bg-white p-4">
          <Skeleton className="h-3 w-24" />
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
