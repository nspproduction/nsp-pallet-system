import { Skeleton } from "@/app/_components/ui";
import { LiffTopBarSkeleton } from "../_loading-shared";

export default function Loading() {
  return (
    <div>
      <LiffTopBarSkeleton title="ยอดคงเหลือ" />
      <div className="space-y-4 p-4">
        <div className="flex gap-2 overflow-x-auto">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-20 shrink-0 rounded-full" />
          ))}
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-white p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <Skeleton className="h-2.5 w-16" />
                <Skeleton className="h-4 w-36" />
              </div>
              <Skeleton className="h-5 w-10 rounded-full" />
            </div>
            <ul className="mt-3 space-y-3">
              {Array.from({ length: 2 }).map((_, j) => (
                <li key={j} className="flex items-center justify-between">
                  <div className="space-y-1.5">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-2.5 w-16" />
                  </div>
                  <Skeleton className="h-3 w-8" />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
