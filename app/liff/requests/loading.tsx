import { Skeleton } from "@/app/_components/ui";
import { LiffTopBarSkeleton, CardListSkeleton } from "../_loading-shared";

export default function Loading() {
  return (
    <div>
      <LiffTopBarSkeleton title="คำขอของฉัน" />
      <div className="p-4">
        <Skeleton className="mb-4 h-12 w-full rounded-xl" />
        <CardListSkeleton count={4} />
      </div>
    </div>
  );
}
