"use client";

// Library
import { useEffect, useState } from "react";
import { twMerge } from "tailwind-merge";

// Components
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { NotificationBell } from "./_notification-bell";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  group: "หลัก" | "ข้อมูลหลัก" | "ตั้งค่า" | "ระบบ";
};

const nav: NavItem[] = [
  { href: "/manage",                  label: "Dashboard",           icon: <DashIcon />,     group: "หลัก" },
  { href: "/manage/requests",         label: "คำขอทั้งหมด",          icon: <InboxIcon />,    group: "หลัก" },
  { href: "/manage/pallet-types",     label: "ประเภทพาเลท",          icon: <StackIcon />,    group: "ข้อมูลหลัก" },
  { href: "/manage/departments",      label: "แผนก",                 icon: <BuildingIcon />, group: "ข้อมูลหลัก" },
  { href: "/manage/users",            label: "ผู้ใช้ & สิทธิ์",       icon: <UserIcon />,     group: "ข้อมูลหลัก" },
  { href: "/manage/approval-routes",  label: "Approval Route",      icon: <RouteIcon />,    group: "ตั้งค่า" },
  { href: "/manage/operating-hours",  label: "ช่วงเวลาทำรายการ",     icon: <ClockIcon />,    group: "ตั้งค่า" },
  { href: "/manage/adjustments",      label: "ปรับยอด",              icon: <SlidersIcon />,  group: "ระบบ" },
  { href: "/manage/audit-logs",       label: "Audit log",            icon: <ShieldIcon />,   group: "ระบบ" },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from localStorage on mount
    setCollapsed(localStorage.getItem("sidebar-collapsed") === "true");
  }, []);

  function toggleCollapsed() {
    setCollapsed((c) => {
      localStorage.setItem("sidebar-collapsed", String(!c));
      return !c;
    });
  }

  async function logout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/auth/login");
  }

  const groups = Array.from(new Set(nav.map((n) => n.group)));

  return (
    <div className="flex min-h-screen bg-surface">
      {/* Sidebar */}
      <aside
        className={twMerge(
          "fixed inset-y-0 left-0 z-40 flex shrink-0 flex-col border-r border-border bg-white transition-all duration-200",
          "w-72",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          "md:sticky md:top-0 md:h-screen md:translate-x-0",
          collapsed ? "md:w-16" : "md:w-72",
        )}
      >
        {/* Logo + collapse toggle */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4">
          <div className={twMerge("flex items-center gap-2.5 overflow-hidden", collapsed && "md:hidden")}>
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-600 text-white shadow-sm shadow-brand-600/30">
              <PalletIcon />
            </div>
            <div className="leading-tight">
              <p className="text-[10px] font-semibold tracking-[0.18em] text-brand-700 uppercase">Noritake</p>
              <p className="text-sm font-semibold text-slate-900">Pallet Admin</p>
            </div>
          </div>

          {/* collapse toggle — desktop only */}
          <button
            onClick={toggleCollapsed}
            title={collapsed ? "ขยาย sidebar" : "ย่อ sidebar"}
            className={twMerge(
              "hidden md:grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors",
              collapsed && "md:mx-auto",
            )}
          >
            {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-2 py-5">
          {groups.map((group) => (
            <div key={group}>
              <p className={twMerge(
                "px-3 pb-2 text-[10px] font-semibold tracking-[0.16em] text-slate-400 uppercase",
                collapsed && "md:hidden",
              )}>
                {group}
              </p>
              <div className="flex flex-col gap-0.5">
                {nav
                  .filter((n) => n.group === group)
                  .map((item) => {
                    const active =
                      item.href === "/manage"
                        ? pathname === "/manage"
                        : pathname?.startsWith(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={collapsed ? item.label : undefined}
                        onClick={() => setMobileOpen(false)}
                        className={twMerge(
                          "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                          active
                            ? "bg-brand-600 text-white shadow-sm shadow-brand-600/30"
                            : "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
                          collapsed && "md:justify-center md:px-2",
                        )}
                      >
                        <span className={twMerge(
                          "grid h-5 w-5 shrink-0 place-items-center",
                          active ? "text-white" : "text-slate-500 group-hover:text-slate-900",
                        )}>
                          {item.icon}
                        </span>
                        <span className={twMerge("font-medium", collapsed && "md:hidden")}>
                          {item.label}
                        </span>
                      </Link>
                    );
                  })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom actions */}
        <div className="shrink-0 border-t border-border p-2 space-y-0.5">
          <Link
            href="/"
            title={collapsed ? "กลับหน้าแรก" : undefined}
            className={twMerge(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-900",
              collapsed && "md:justify-center md:px-2",
            )}
          >
            <span className="shrink-0"><HomeIcon /></span>
            <span className={twMerge(collapsed && "md:hidden")}>กลับหน้าแรก</span>
          </Link>
          <button
            onClick={logout}
            disabled={loggingOut}
            title={collapsed ? "ลงชื่อออก" : undefined}
            className={twMerge(
              "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50",
              collapsed && "md:justify-center md:px-2",
            )}
          >
            <span className="shrink-0"><LogoutIcon /></span>
            <span className={twMerge(collapsed && "md:hidden")}>{loggingOut ? "กำลังออก..." : "ลงชื่อออก"}</span>
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <button
          aria-label="ปิดเมนู"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm md:hidden"
        />
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-white/80 px-4 backdrop-blur md:px-8">
          {/* Mobile hamburger */}
          <button
            aria-label="เปิดเมนู"
            onClick={() => setMobileOpen(true)}
            className="grid h-9 w-9 place-items-center rounded-lg border border-border text-slate-600 hover:bg-slate-50 md:hidden"
          >
            <MenuIcon />
          </button>

          <div className="flex flex-1 items-center gap-2 text-sm text-slate-500">
            <span className="hidden sm:inline">Admin</span>
            <span className="hidden sm:inline text-slate-300">/</span>
            <span className="font-medium text-slate-900">
              {nav.find((n) =>
                n.href === "/manage" ? pathname === "/manage" : pathname?.startsWith(n.href),
              )?.label ?? "หน้าแรก"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <NotificationBell />
            <button
              onClick={logout}
              disabled={loggingOut}
              title="ลงชื่อออก"
              className="flex h-9 items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
            >
              <LogoutIcon />
              <span className="hidden sm:inline">{loggingOut ? "กำลังออก..." : "ลงชื่อออก"}</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

/* ---------- icons ---------- */
function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      {children}
    </svg>
  );
}
function PalletIcon() {
  return <Icon><rect x="3" y="4" width="18" height="10" rx="1" /><path d="M3 14v4M9 14v4M15 14v4M21 14v4M3 18h18" /></Icon>;
}
function DashIcon() {
  return <Icon><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></Icon>;
}
function InboxIcon() {
  return <Icon><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></Icon>;
}
function ClockIcon() {
  return <Icon><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Icon>;
}
function StackIcon() {
  return <Icon><path d="M12 3l9 5-9 5-9-5 9-5z" /><path d="M3 13l9 5 9-5" /><path d="M3 18l9 5 9-5" /></Icon>;
}
function UserIcon() {
  return <Icon><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></Icon>;
}
function SlidersIcon() {
  return <Icon><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3" /><path d="M1 14h6M9 8h6M17 16h6" /></Icon>;
}
function BuildingIcon() {
  return <Icon><path d="M3 21V7l9-4 9 4v14" /><path d="M9 21V11h6v10" /><path d="M3 21h18" /></Icon>;
}
function ShieldIcon() {
  return <Icon><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></Icon>;
}
function MenuIcon() {
  return <Icon><path d="M3 12h18M3 6h18M3 18h18" /></Icon>;
}
function RouteIcon() {
  return <Icon><circle cx="5" cy="6" r="2" /><path d="M7 6h3a2 2 0 0 1 2 2v8a2 2 0 0 0 2 2h3" /><circle cx="19" cy="18" r="2" /></Icon>;
}
function LogoutIcon() {
  return <Icon><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></Icon>;
}
function HomeIcon() {
  return <Icon><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></Icon>;
}
function ChevronLeftIcon() {
  return <Icon><path d="M15 18l-6-6 6-6" /></Icon>;
}
function ChevronRightIcon() {
  return <Icon><path d="M9 18l6-6-6-6" /></Icon>;
}
