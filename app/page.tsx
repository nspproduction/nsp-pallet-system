import Link from "next/link";
import { AuthPanel } from "./_components/AuthPanel";

export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-col">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="bg-grid absolute inset-0 opacity-60" />
        <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-brand-200/50 blur-3xl" />
      </div>

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white shadow-sm shadow-brand-600/30">
            <PalletIcon className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-brand-700 uppercase">
              Noritake
            </p>
            <p className="text-sm font-semibold text-slate-900">
              Pallet Dispatch
            </p>
          </div>
        </div>
        <a
          href="/docs/REQUIREMENTS.md"
          className="hidden text-sm text-slate-600 hover:text-slate-900 sm:block"
        >
          เอกสารระบบ →
        </a>
      </header>

      <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center gap-14 px-6 py-16 text-center">
        <div className="space-y-5">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/70 px-3 py-1 text-xs font-medium text-brand-700 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-600" />
            ระบบภายในโรงงาน · v0.1
          </span>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl sm:leading-[1.1]">
            ระบบเบิกจ่ายพาเลท
            <span className="block bg-gradient-to-r from-brand-600 to-brand-900 bg-clip-text text-transparent">
              ควบคุมทุกใบเบิก ทุกยอดคงเหลือ
            </span>
          </h1>
          <p className="mx-auto max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
            จัดการการเบิก · รับ · คืน · ซ่อม พาเลทของโรงงาน
            ทั้งภายในและที่หมุนเวียนกับลูกค้า ผ่านเว็บและ LINE ได้ในที่เดียว
          </p>
        </div>

        <div className="w-full max-w-2xl">
          <AuthPanel devMode={process.env.NODE_ENV !== "production"} />
        </div>

        <div className="grid w-full max-w-4xl gap-4 sm:grid-cols-2">
          <PortalCard
            href="/liff"
            eyebrow="สำหรับพนักงาน"
            title="LIFF บน LINE"
            description="สร้างคำขอ ตรวจสอบสถานะ และอนุมัติผ่านมือถือได้ทันที"
            icon={<PhoneIcon className="h-6 w-6" />}
            accent="brand"
          />
          <PortalCard
            href="/admin"
            eyebrow="สำหรับผู้ดูแล"
            title="Admin Console"
            description="Dashboard, จัดการข้อมูลหลัก, รายงาน, Audit log ครบทุกด้าน"
            icon={<GaugeIcon className="h-6 w-6" />}
            accent="slate"
          />
        </div>

        <div className="grid w-full max-w-4xl gap-3 sm:grid-cols-3">
          <Feature icon={<CheckIcon />} title="ติดตามยอดค้าง" text="ทุกลูกค้าและทุกไลน์" />
          <Feature icon={<CheckIcon />} title="อนุมัติหลายชั้น" text="ปลอดภัย ตรวจย้อนกลับได้" />
          <Feature icon={<CheckIcon />} title="Audit log ครบถ้วน" text="ทุกการเคลื่อนไหว" />
        </div>
      </section>

      <footer className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 border-t border-border px-6 py-6 text-xs text-slate-500 sm:flex-row">
        <p>© {new Date().getFullYear()} Noritake · Pallet Dispatch System</p>
        <div className="flex items-center gap-4">
          <a className="hover:text-slate-900" href="/docs/REQUIREMENTS.md">
            Requirement
          </a>
          <span className="text-slate-300">·</span>
          <a className="hover:text-slate-900" href="/docs/ER_DIAGRAM.md">
            ER Diagram
          </a>
        </div>
      </footer>
    </main>
  );
}

function PortalCard({
  href,
  eyebrow,
  title,
  description,
  icon,
  accent,
}: {
  href: string;
  eyebrow: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  accent: "brand" | "slate";
}) {
  const isBrand = accent === "brand";
  return (
    <Link
      href={href}
      className={`group relative overflow-hidden rounded-2xl border p-6 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg ${
        isBrand
          ? "border-brand-200 bg-gradient-to-br from-white to-brand-50 hover:border-brand-500"
          : "border-slate-200 bg-white hover:border-slate-900"
      }`}
    >
      <div className="flex items-start justify-between">
        <div
          className={`grid h-12 w-12 place-items-center rounded-xl ${
            isBrand
              ? "bg-brand-600 text-white shadow-md shadow-brand-600/30"
              : "bg-slate-900 text-white"
          }`}
        >
          {icon}
        </div>
        <ArrowIcon className="h-5 w-5 text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-slate-900" />
      </div>
      <div className="mt-5">
        <p
          className={`text-[11px] font-semibold tracking-[0.14em] uppercase ${
            isBrand ? "text-brand-700" : "text-slate-500"
          }`}
        >
          {eyebrow}
        </p>
        <h2 className="mt-1 text-xl font-bold text-slate-900">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
      </div>
    </Link>
  );
}

function Feature({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-white/60 p-4 text-left backdrop-blur">
      <span className="mt-0.5 grid h-6 w-6 place-items-center rounded-full bg-brand-100 text-brand-700">
        {icon}
      </span>
      <div>
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="text-xs text-slate-500">{text}</p>
      </div>
    </div>
  );
}

function PalletIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="3" y="4" width="18" height="10" rx="1" />
      <path d="M3 14v4M9 14v4M15 14v4M21 14v4M3 18h18" />
    </svg>
  );
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <path d="M11 18h2" />
    </svg>
  );
}

function GaugeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 14l4-4" />
      <path d="M3.34 17A10 10 0 1 1 20.66 17" />
    </svg>
  );
}

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
    >
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}
