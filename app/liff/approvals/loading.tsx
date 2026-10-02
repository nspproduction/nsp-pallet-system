import { LiffTopBarSkeleton, CardListSkeleton } from "../_loading-shared";

export default function Loading() {
  return (
    <div>
      <LiffTopBarSkeleton title="รออนุมัติ" />
      <div className="p-4">
        <CardListSkeleton count={3} />
      </div>
    </div>
  );
}
