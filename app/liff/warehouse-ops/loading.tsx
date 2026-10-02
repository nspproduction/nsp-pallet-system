import { Skeleton } from "@/app/_components/ui";
import { LiffTopBarSkeleton } from "../_loading-shared";

export default function Loading() {
  return (
    <div>
      <LiffTopBarSkeleton title="จัดการคลังพาเลท" />
      <div className="space-y-3 p-4">
        <Skeleton className="h-3 w-64" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-2xl border border-border bg-white p-4">
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="h-4 w-40" />
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 3 }).map((_, j) => (
                <Skeleton key={j} className="h-14 rounded-lg" />
              ))}
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 flex-1 rounded-lg" />
              <Skeleton className="h-9 flex-1 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
