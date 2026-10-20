"use client";

// Library
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { twMerge } from "tailwind-merge";

// Components
import { Skeleton } from "@/app/_components/ui";

type Status = "loading" | "ready";

interface Profile {
  userId: string;
  fullName: string;
  roles: string[];
}

async function readMe(): Promise<{
  authenticated: boolean;
  needsRegistration?: boolean;
  user?: { id: string; fullName: string; roles: string[]; status: string };
} | null> {
  try {
    const res = await fetch("/api/auth/me");
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default function PortalHome() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("loading");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/auth/login");
  }

  useEffect(() => {
    (async () => {
      const me = await readMe();

      if (!me?.authenticated || !me.user) {
        router.replace("/auth/login?next=/app");
        return;
      }

      setProfile({
        userId: me.user.id,
        fullName: me.user.fullName,
        roles: me.user.roles
      });

      if (me.user.status === "DISABLED" || me.user.status === "PENDING") {
        await fetch("/api/auth/logout", { method: "POST" });
        router.replace("/auth/login");
        return;
      }
      setStatus("ready");
    })();
  }, [router]);

  if (status === "loading") {
    return (
      <div className="flex flex-col">
        <header className="relative overflow-hidden bg-linear-to-br from-brand-600 to-brand-900 px-6 pt-8 pb-6 text-white">
          <div className="relative flex items-center gap-3">
            <Skeleton className="h-14 w-14 shrink-0 rounded-full bg-white/20" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-2.5 w-16 bg-white/20" />
              <Skeleton className="h-4 w-32 bg-white/20" />
            </div>
          </div>
          <Skeleton className="relative mt-3 h-3 w-48 bg-white/20" />
        </header>
        <div className="px-4 pt-4">
          <div className="grid grid-cols-2 gap-3 rounded-2xl border border-border bg-white p-3 shadow-sm">
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
          </div>
        </div>
        <section className="flex flex-col gap-3 px-4 py-6">
          <Skeleton className="h-3 w-20" />
          {Array.from({ length: 3 }).map((_, i) => (
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

  const roles = profile?.roles ?? [];
  const canCreate = roles.some((r) => ["REQUESTER", "ADMIN"].includes(r));
  const canApprove = roles.some((r) => ["DEPT_APPROVER", "PALLET_MANAGER", "ADMIN"].includes(r));
  const canManageWarehouse = roles.some((r) => ["PALLET_MANAGER", "ADMIN"].includes(r));
  const canViewDashboard = true; // all authenticated users can view dashboard

  return (
    <div className="flex flex-col">
      {/* Hero header */}
      <header className="relative overflow-hidden bg-linear-to-br from-brand-600 to-brand-900 px-6 pt-8 pb-6 text-white">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/30 blur-2xl" />
          <div className="absolute bottom-0 left-1/3 h-32 w-32 rounded-full bg-white/20 blur-2xl" />
        </div>
        <div className="relative flex items-center gap-3">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white/20 text-lg font-semibold">
            {profile?.fullName?.[0] ?? "?"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-widest text-white/70">สวัสดี</p>
            <p className="mt-0.5 truncate text-lg font-semibold">{profile?.fullName}</p>
          </div>
          <button
            onClick={logout}
            disabled={loggingOut}
            title="ลงชื่อออก"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25 disabled:opacity-50"
          >
            <LogoutIcon />
          </button>
        </div>
      </header>

      {/* Quick actions card */}
      {canCreate && (
        <div className="px-4 pt-4">
          <div className="rounded-2xl border border-border bg-white p-3 shadow-sm">
            <QuickAction href="/app/requests/new" icon={<PlusIcon />} label="สร้างคำขอ" primary />
          </div>
        </div>
      )}

      {/* Menu */}
      <section className="flex flex-col gap-3 px-4 py-6">
        <SectionTitle>เมนูหลัก</SectionTitle>
        {canCreate && <MenuItem href="/app/requests" icon={<InboxIcon />} title="คำขอของฉัน" subtitle="ดูสถานะและประวัติ" />}
        {canApprove && (
          <>
            <MenuItem href="/app/approvals" icon={<CheckIcon />} title="รออนุมัติ" subtitle="คำขอที่รอฉันตัดสินใจ" />
            <MenuItem href="/app/approvals/history" icon={<HistoryIcon />} title="ประวัติอนุมัติ" subtitle="คำขอที่ฉันเคยตัดสินใจแล้ว" />
          </>
        )}
        {canManageWarehouse && (
          <>
            <MenuItem href="/app/warehouse-ops" icon={<WrenchIcon />} title="จัดการคลังพาเลท" subtitle="ซ่อม · ตัดจำหน่าย" />
            <MenuItem href="/app/balance" icon={<BoxIcon />} title="ยอดคงเหลือในคลัง" subtitle="แยกตามแผนก · ตามสภาพ" />
          </>
        )}
        {canViewDashboard && <MenuItem href="/app/dashboard" icon={<ChartIcon />} title="ภาพรวมระบบ" subtitle="สถิติและรายงาน" />}
      </section>
    </div>
  );
}

function QuickAction({ href, icon, label, primary }: { href: string; icon: React.ReactNode; label: string; primary?: boolean }) {
  return (
    <a
      href={href}
      className={twMerge(
        "flex flex-col items-center justify-center gap-2 rounded-xl p-4 transition active:scale-[0.98]",
        primary ? "bg-brand-600 text-white shadow-sm shadow-brand-600/30" : "bg-slate-50 text-slate-800 hover:bg-slate-100"
      )}
    >
      <span className={twMerge("grid h-9 w-9 place-items-center rounded-full", primary ? "bg-white/20" : "bg-white")}>{icon}</span>
      <span className="text-sm font-semibold">{label}</span>
    </a>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="px-1 text-[11px] font-semibold tracking-[0.14em] text-slate-400 uppercase">{children}</p>;
}

function MenuItem({ href, icon, title, subtitle, badge }: { href: string; icon: React.ReactNode; title: string; subtitle: string; badge?: string }) {
  return (
    <a
      href={href}
      className="flex items-center gap-4 rounded-2xl border border-border bg-white p-4 transition active:scale-[0.99] active:bg-slate-50"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold text-slate-900">{title}</p>
        <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
      </div>
      {badge && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">{badge}</span>}
      <ChevronIcon />
    </a>
  );
}

/* icons */
function Icon({ children, className = "h-5 w-5" }: { children: React.ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {children}
    </svg>
  );
}
function PlusIcon() {
  return (
    <Icon>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  );
}
function InboxIcon() {
  return (
    <Icon>
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </Icon>
  );
}
function CheckIcon() {
  return (
    <Icon>
      <path d="M20 6L9 17l-5-5" />
    </Icon>
  );
}
function HistoryIcon() {
  return (
    <Icon>
      <path d="M3 3v5h5" />
      <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
      <path d="M12 7v5l4 2" />
    </Icon>
  );
}
function BoxIcon() {
  return (
    <Icon>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="M3.27 6.96L12 12.01l8.73-5.05" />
      <path d="M12 22.08V12" />
    </Icon>
  );
}
function WrenchIcon() {
  return (
    <Icon>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </Icon>
  );
}
function ChevronIcon() {
  return (
    <Icon className="h-4 w-4 text-slate-400">
      <path d="M9 6l6 6-6 6" />
    </Icon>
  );
}
function LogoutIcon() {
  return (
    <Icon className="h-4 w-4">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </Icon>
  );
}
function ChartIcon() {
  return (
    <Icon>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </Icon>
  );
}
