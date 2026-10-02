"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  group: "หลัก" | "ข้อมูลหลัก" | "ระบบ";
};

const nav: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: <DashIcon />, group: "หลัก" },
  { href: "/admin/requests", label: "คำขอทั้งหมด", icon: <InboxIcon />, group: "หลัก" },
  { href: "/admin/pallet-types", label: "ประเภทพาเลท", icon: <StackIcon />, group: "ข้อมูลหลัก" },
  { href: "/admin/departments", label: "แผนก", icon: <BuildingIcon />, group: "ข้อมูลหลัก" },
  { href: "/admin/users", label: "ผู้ใช้ & สิทธิ์", icon: <UserIcon />, group: "ข้อมูลหลัก" },
  { href: "/admin/adjustments", label: "ปรับยอด", icon: <SlidersIcon />, group: "ระบบ" },
  { href: "/admin/audit-logs", label: "Audit log", icon: <ShieldIcon />, group: "ระบบ" },
];

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const groups = Array.from(new Set(nav.map((n) => n.group)));

  return (
    <div className="flex min-h-screen bg-surface">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 shrink-0 transform border-r border-border bg-white transition-transform md:static md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="flex h-16 items-center gap-2.5 border-b border-border px-6">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white shadow-sm shadow-brand-600/30">
            <PalletIcon />
          </div>
          <div className="leading-tight">
            <p className="text-[10px] font-semibold tracking-[0.18em] text-brand-700 uppercase">
              Noritake
            </p>
            <p className="text-sm font-semibold text-slate-900">Pallet Admin</p>
          </div>
        </div>

        <nav className="flex flex-col gap-6 overflow-y-auto px-3 py-5">
          {groups.map((group) => (
            <div key={group}>
              <p className="px-3 pb-2 text-[10px] font-semibold tracking-[0.16em] text-slate-400 uppercase">
                {group}
              </p>
              <div className="flex flex-col gap-1">
                {nav
                  .filter((n) => n.group === group)
                  .map((item) => {
                    const active =
                      item.href === "/admin"
                        ? pathname === "/admin"
                        : pathname?.startsWith(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                          active
                            ? "bg-brand-600 text-white shadow-sm shadow-brand-600/30"
                            : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                        }`}
                      >
                        <span
                          className={`grid h-5 w-5 place-items-center ${
                            active ? "text-white" : "text-slate-500 group-hover:text-slate-900"
                          }`}
                        >
                          {item.icon}
                        </span>
                        <span className="font-medium">{item.label}</span>
                      </Link>
                    );
                  })}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-auto border-t border-border p-4">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <span>←</span> กลับหน้าแรก
          </Link>
        </div>
      </aside>

      {/* Overlay (mobile) */}
      {open && (
        <button
          aria-label="close menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm md:hidden"
        />
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-white/80 px-4 backdrop-blur md:px-8">
          <button
            aria-label="เปิดเมนู"
            onClick={() => setOpen(true)}
            className="grid h-9 w-9 place-items-center rounded-lg border border-border text-slate-600 hover:bg-slate-50 md:hidden"
          >
            <MenuIcon />
          </button>

          <div className="flex flex-1 items-center gap-2 text-sm text-slate-500">
            <span className="hidden sm:inline">Admin</span>
            <span className="hidden sm:inline text-slate-300">/</span>
            <span className="font-medium text-slate-900">
              {nav.find((n) =>
                n.href === "/admin" ? pathname === "/admin" : pathname?.startsWith(n.href)
              )?.label ?? "หน้าแรก"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button className="hidden h-9 items-center gap-2 rounded-lg border border-border bg-white px-3 text-sm text-slate-600 hover:bg-slate-50 sm:flex">
              <SearchIcon />
              <span>ค้นหา…</span>
              <kbd className="ml-2 rounded border border-border bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-500">
                ⌘K
              </kbd>
            </button>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
              N
            </div>
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
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      {children}
    </svg>
  );
}
function PalletIcon() {
  return (
    <Icon>
      <rect x="3" y="4" width="18" height="10" rx="1" />
      <path d="M3 14v4M9 14v4M15 14v4M21 14v4M3 18h18" />
    </Icon>
  );
}
function DashIcon() {
  return (
    <Icon>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
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
function ClockIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Icon>
  );
}
function StackIcon() {
  return (
    <Icon>
      <path d="M12 3l9 5-9 5-9-5 9-5z" />
      <path d="M3 13l9 5 9-5" />
      <path d="M3 18l9 5 9-5" />
    </Icon>
  );
}
function PinIcon() {
  return (
    <Icon>
      <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </Icon>
  );
}
function UserIcon() {
  return (
    <Icon>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </Icon>
  );
}
function SlidersIcon() {
  return (
    <Icon>
      <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3" />
      <path d="M1 14h6M9 8h6M17 16h6" />
    </Icon>
  );
}
function BuildingIcon() {
  return (
    <Icon>
      <path d="M3 21V7l9-4 9 4v14" />
      <path d="M9 21V11h6v10" />
      <path d="M3 21h18" />
    </Icon>
  );
}
function ShieldIcon() {
  return (
    <Icon>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </Icon>
  );
}
function MenuIcon() {
  return (
    <Icon>
      <path d="M3 12h18M3 6h18M3 18h18" />
    </Icon>
  );
}
function SearchIcon() {
  return (
    <Icon>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </Icon>
  );
}
