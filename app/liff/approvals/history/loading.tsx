import { LiffTopBarSkeleton, CardListSkeleton } from "../../_loading-shared";

export default function Loading() {
  return (
    <div>
      <LiffTopBarSkeleton title="ประวัติอนุมัติ" />
      <div className="p-4">
        <CardListSkeleton count={4} />
      </div>
    </div>
  );
}
