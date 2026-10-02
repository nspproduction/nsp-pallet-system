"use client";

// Library
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Components
import { Skeleton } from "@/app/_components/ui";

// Lib
import { ensureLoggedIn, getLiff, LiffError } from "@/lib/liff/client";

// Best-effort fetch of LINE display name + picture. Returns null if not in a
// LIFF environment or user isn't LINE-logged-in (e.g. dev-login via /).
async function tryLineProfile(): Promise<{ displayName: string; pictureUrl?: string } | null> {
  try {
    const liff = await getLiff();
    if (!liff.isLoggedIn()) return null;
    const p = await liff.getProfile();
    return { displayName: p.displayName, pictureUrl: p.pictureUrl };
  } catch {
    return null;
  }
}

type Status = "loading" | "ready" | "pending" | "disabled" | "error";

interface Profile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  role?: string;
}

interface ErrorInfo {
  step: string;
  message: string;
  raw?: string;
}

async function readMe(): Promise<{
  authenticated: boolean;
  needsRegistration?: boolean;
  user?: { id: string; fullName: string; role: string; status: string };
} | null> {
  const res = await fetch("/api/auth/me");
  if (!res.ok) return null;
  return res.json();
}

export default function LiffHome() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("loading");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<ErrorInfo | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // 1) ถ้ามี session อยู่แล้ว → ใช้ me เป็นแหล่งข้อมูลหลัก, overlay ด้วย LINE profile ถ้าได้
        const existing = await readMe();
        if (existing?.authenticated && existing.user) {
          const line = await tryLineProfile();
          applyMe(existing, line);
          return;
        }

        // 2) ไม่มี session → LIFF login → provision user via /api/auth/line
        const liff = await ensureLoggedIn();
        const idToken = liff.getIDToken();
        if (idToken) {
          const res = await fetch("/api/auth/line", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ idToken }),
          });
          if (!res.ok) {
            console.warn("[liff] /api/auth/line responded", res.status, await res.text());
          }
        }

        // Re-fetch /api/auth/me to resolve status (PENDING/DISABLED/ACTIVE)
        const meAfter = await readMe();
        if (meAfter?.authenticated && meAfter.user) {
          const line = await tryLineProfile();
          applyMe(meAfter, line);
          return;
        }

        // Fallback: show LINE profile but we have no backend session yet
        const p = await liff.getProfile();
        setProfile({ userId: p.userId, displayName: p.displayName, pictureUrl: p.pictureUrl });
        setStatus("error");
      } catch (err) {
        console.error("[liff] init error", err);
        if (err instanceof LiffError) {
          setError({
            step: err.step,
            message: err.message,
            raw: err.cause instanceof Error ? err.cause.message : undefined,
          });
        } else {
          setError({
            step: "unknown",
            message: err instanceof Error ? err.message : String(err),
          });
        }
        setStatus("error");
      }
    })();

    function applyMe(
      me: {
        needsRegistration?: boolean;
        user?: { id: string; fullName: string; role: string; status: string };
      },
      line: { displayName: string; pictureUrl?: string } | null,
    ) {
      if (!me.user) return;
      // Prefer LINE displayName + pictureUrl for presentation. Fall back to DB fullName
      // when LIFF profile isn't available (e.g. dev-login in browser).
      setProfile({
        userId: me.user.id,
        displayName: line?.displayName || me.user.fullName,
        pictureUrl: line?.pictureUrl,
        role: me.user.role,
      });
      if (me.needsRegistration) {
        router.replace("/liff/register");
        return;
      }
      if (me.user.status === "DISABLED") {
        setStatus("disabled");
        return;
      }
      if (me.user.status === "PENDING") {
        setStatus("pending");
        return;
      }
      setStatus("ready");
    }
  }, [router]);

  if (status === "loading") {
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

  if (status === "pending") {
    return (
      <CenteredMessage>
        <div className="grid h-14 w-14 place-items-center rounded-full bg-amber-100 text-amber-700">⏳</div>
        <p className="mt-4 text-base font-semibold text-slate-900">กำลังรอการอนุมัติการลงทะเบียน</p>
        <p className="mt-2 max-w-xs text-xs leading-relaxed text-slate-600">
          แอดมินจะตรวจสอบและเปิดการใช้งานให้คุณ กรุณากลับมาเปิดอีกครั้งภายหลัง
        </p>
        {profile?.displayName && (
          <p className="mt-3 text-xs text-slate-500">{profile.displayName}</p>
        )}
      </CenteredMessage>
    );
  }

  if (status === "disabled") {
    return (
      <CenteredMessage>
        <div className="grid h-14 w-14 place-items-center rounded-full bg-rose-100 text-rose-600">🚫</div>
        <p className="mt-4 text-base font-semibold text-slate-900">บัญชีของคุณถูกระงับชั่วคราว</p>
        <p className="mt-2 max-w-xs text-xs leading-relaxed text-slate-600">
          หากคิดว่าเกิดจากความผิดพลาด กรุณาติดต่อแอดมิน
        </p>
        {profile?.displayName && (
          <p className="mt-3 text-xs text-slate-500">{profile.displayName}</p>
        )}
      </CenteredMessage>
    );
  }

  if (status === "error") {
    const stepLabel: Record<string, string> = {
      env: "สภาพแวดล้อม",
      config: "การตั้งค่า",
      init: "เริ่มต้น LIFF",
      login: "เข้าสู่ระบบ LINE",
      unknown: "ไม่ทราบสาเหตุ"
    };
    return (
      <CenteredMessage>
        <div className="grid h-14 w-14 place-items-center rounded-full bg-rose-100 text-rose-600">
          <AlertIcon />
        </div>
        <p className="mt-4 text-base font-semibold text-slate-900">เชื่อมต่อ LINE ไม่สำเร็จ</p>
        <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
          ขั้นตอน: {stepLabel[error?.step ?? "unknown"] ?? error?.step}
        </span>
        <p className="mt-3 max-w-xs text-xs leading-relaxed text-slate-600">{error?.message}</p>
        {error?.raw && (
          <details className="mt-3 max-w-xs text-left">
            <summary className="cursor-pointer text-[11px] text-slate-400">รายละเอียดทางเทคนิค</summary>
            <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-slate-50 p-2 text-[10px] text-slate-600">{error.raw}</pre>
          </details>
        )}
        <div className="mt-6 flex gap-2">
          <button
            onClick={() => location.reload()}
            className="h-10 rounded-full bg-brand-600 px-6 text-sm font-medium text-white shadow-sm shadow-brand-600/30"
          >
            ลองใหม่อีกครั้ง
          </button>
        </div>
        <ul className="mt-6 max-w-xs space-y-1.5 text-left text-[11px] text-slate-500">
          <li>• เปิดจากใน LINE (แนะนำ) หรือ browser ที่รองรับ cookie</li>
          <li>• URL ต้องตรงกับ Endpoint URL ที่ตั้งไว้ใน LIFF console</li>
          <li>• LIFF app ต้องถูก publish และมี scope: profile, openid</li>
        </ul>
      </CenteredMessage>
    );
  }

  const role = profile?.role;
  const canCreate = role === "REQUESTER" || role === "ADMIN";
  const canApprove = role === "APPROVER" || role === "ADMIN";
  const canFulfill = role === "STORE" || role === "ADMIN";

  return (
    <div className="flex flex-col">
      {/* Hero header */}
      <header className="relative overflow-hidden bg-gradient-to-br from-brand-600 to-brand-900 px-6 pt-8 pb-6 text-white">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/30 blur-2xl" />
          <div className="absolute bottom-0 left-1/3 h-32 w-32 rounded-full bg-white/20 blur-2xl" />
        </div>
        <div className="relative flex items-center gap-3">
          {profile?.pictureUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.pictureUrl} alt="" className="h-14 w-14 shrink-0 rounded-full ring-2 ring-white/60" />
          ) : (
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white/20 text-lg font-semibold">
              {profile?.displayName?.[0] ?? "?"}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest text-white/70">สวัสดี</p>
            <p className="mt-0.5 truncate text-lg font-semibold">{profile?.displayName}</p>
          </div>
        </div>
      </header>

      {/* Quick actions card */}
      {canCreate && (
        <div className="px-4 pt-4">
          <div className="rounded-2xl border border-border bg-white p-3 shadow-sm">
            <QuickAction href="/liff/requests/new" icon={<PlusIcon />} label="สร้างคำขอ" primary />
          </div>
        </div>
      )}

      {/* Menu */}
      <section className="flex flex-col gap-3 px-4 py-6">
        <SectionTitle>เมนูหลัก</SectionTitle>
        <MenuItem href="/liff/requests" icon={<InboxIcon />} title="คำขอของฉัน" subtitle="ดูสถานะและประวัติ" />
        {canApprove && (
          <MenuItem href="/liff/approvals" icon={<CheckIcon />} title="รออนุมัติ" subtitle="คำขอที่รอฉันตัดสินใจ" />
        )}
        {canFulfill && (
          <>
            <MenuItem href="/liff/fulfillments" icon={<TruckIcon />} title="คำขอรอจ่าย/รอรับ" subtitle="ยืนยันส่งมอบคำขอที่อนุมัติแล้ว" />
            <MenuItem href="/liff/balance" icon={<BoxIcon />} title="ยอดสต็อก" subtitle="ยอดคงเหลือในคลัง" />
          </>
        )}
      </section>

      {/* Footer */}
      <div className="mt-auto px-4 pb-6 text-center">
        <p className="text-[11px] text-slate-400">Noritake Pallet Dispatch · v0.1</p>
      </div>
    </div>
  );
}

function QuickAction({ href, icon, label, primary }: { href: string; icon: React.ReactNode; label: string; primary?: boolean }) {
  return (
    <a
      href={href}
      className={`flex flex-col items-center justify-center gap-2 rounded-xl p-4 transition active:scale-[0.98] ${
        primary ? "bg-brand-600 text-white shadow-sm shadow-brand-600/30" : "bg-slate-50 text-slate-800 hover:bg-slate-100"
      }`}
    >
      <span className={`grid h-9 w-9 place-items-center rounded-full ${primary ? "bg-white/20" : "bg-white"}`}>{icon}</span>
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

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">{children}</div>;
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
function TruckIcon() {
  return (
    <Icon>
      <path d="M1 3h15v13H1z" />
      <path d="M16 8h4l3 3v5h-7V8z" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
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
function ChevronIcon() {
  return (
    <Icon className="h-4 w-4 text-slate-400">
      <path d="M9 6l6 6-6 6" />
    </Icon>
  );
}
function AlertIcon() {
  return (
    <Icon className="h-6 w-6">
      <path d="M12 9v4M12 17h.01" />
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    </Icon>
  );
}
