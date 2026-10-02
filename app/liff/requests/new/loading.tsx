import { Skeleton } from "@/app/_components/ui";
import { LiffTopBarSkeleton } from "../../_loading-shared";

export default function Loading() {
  return (
    <div>
      <LiffTopBarSkeleton title="สร้างคำขอ" />
      <div className="space-y-5 p-4 pb-32">
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <div className="space-y-3 rounded-2xl border border-border bg-white p-4">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-11 w-full rounded-lg" />
          <Skeleton className="h-11 w-full rounded-lg" />
        </div>
        <div className="space-y-3 rounded-2xl border border-border bg-white p-4">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-11 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
