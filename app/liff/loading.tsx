import { Skeleton } from "@/app/_components/ui";

export default function Loading() {
  return (
    <div className="flex flex-col">
      <header className="relative overflow-hidden bg-gradient-to-br from-brand-600 to-brand-900 px-6 pt-8 pb-6 text-white">
        <div className="relative flex items-center gap-3">
          <Skeleton className="h-14 w-14 shrink-0 rounded-full bg-white/20" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-2.5 w-16 bg-white/20" />
            <Skeleton className="h-4 w-32 bg-white/20" />
          </div>
        </div>
      </header>
      <section className="flex flex-col gap-3 px-4 py-6">
        <Skeleton className="h-3 w-20" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 rounded-2xl border border-border bg-white p-4">
            <Skeleton className="h-11 w-11 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
