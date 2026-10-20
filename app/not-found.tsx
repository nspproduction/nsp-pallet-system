import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-130 w-130 -translate-x-1/2 rounded-full bg-brand-200/30 blur-3xl" />
      </div>

      <div className="relative flex w-full max-w-sm flex-col items-center gap-6 rounded-2xl border border-border bg-white px-8 py-10 shadow-sm">
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-brand-50 text-brand-600">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-8 w-8"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
        </div>

        <div className="text-center">
          <p className="text-6xl font-extrabold tracking-tight text-brand-600">404</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">ไม่พบหน้าที่ต้องการ</p>
          <p className="mt-1.5 text-sm text-slate-500">หน้านี้อาจถูกลบ เปลี่ยน URL หรือไม่เคยมีอยู่</p>
        </div>

        <Link
          href="/"
          className="w-full rounded-xl bg-brand-600 py-2.5 text-center text-sm font-semibold text-white shadow-sm shadow-brand-600/20 transition hover:bg-brand-700 active:scale-[0.98]"
        >
          กลับหน้าหลัก
        </Link>
      </div>
    </main>
  );
}
