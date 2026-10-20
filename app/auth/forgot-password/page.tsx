"use client";

// Library
import { useState } from "react";

// Components
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canSubmit = !busy && email.trim().length > 0;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim() })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "เกิดข้อผิดพลาด กรุณาลองใหม่");
      }
      setSent(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-130 w-130 -translate-x-1/2 rounded-full bg-brand-200/40 blur-3xl" />
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-border bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white shadow-sm shadow-brand-600/30">
            <PalletIcon />
          </div>
          <div className="leading-tight">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-brand-700 uppercase">Noritake</p>
            <p className="text-sm font-semibold text-slate-900">ระบบพาเลท</p>
          </div>
        </div>

        <h1 className="mt-5 text-xl font-bold text-slate-900">ลืมรหัสผ่าน</h1>
        <p className="mt-1 text-xs text-slate-500">กรอกอีเมลของคุณ เราจะส่งลิงก์รีเซ็ตรหัสผ่านให้</p>

        {sent ? (
          <div className="mt-6 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
            ถ้า email นี้มีในระบบ เราจะส่งลิงก์รีเซ็ตรหัสผ่านให้ทางอีเมล
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-3">
            <label className="block">
              <span className="text-xs font-medium text-slate-600">อีเมล</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                placeholder="example@company.com"
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-brand-500"
              />
            </label>

            {err && <p className="rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700">{err}</p>}

            <button
              type="submit"
              disabled={!canSubmit}
              className="h-10 w-full rounded-lg bg-brand-600 text-sm font-semibold text-white shadow-sm shadow-brand-600/30 hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "กำลังส่ง..." : "ส่งลิงก์รีเซ็ตรหัสผ่าน"}
            </button>
          </form>
        )}

        <Link href="/auth/login" className="mt-5 inline-block text-xs text-slate-500 hover:text-slate-700">
          ← กลับหน้าเข้าสู่ระบบ
        </Link>
      </div>
    </main>
  );
}

function PalletIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <rect x="3" y="4" width="18" height="10" rx="1" />
      <path d="M3 14v4M9 14v4M15 14v4M21 14v4M3 18h18" />
    </svg>
  );
}
