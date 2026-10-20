"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}

type TokenState = "verifying" | "valid" | "invalid";

function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [tokenState, setTokenState] = useState<TokenState>("verifying");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- derive validity from URL token
      setTokenState("invalid");
      return;
    }
    void fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`)
      .then((r) => setTokenState(r.ok ? "valid" : "invalid"))
      .catch(() => setTokenState("invalid"));
  }, [token]);

  const canSubmit = !busy && password.length >= 8 && confirm.length > 0 && !success;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    if (password !== confirm) { setErr("รหัสผ่านไม่ตรงกัน"); return; }
    if (password.length < 8)  { setErr("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"); return; }

    setBusy(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "เกิดข้อผิดพลาด กรุณาลองใหม่");
      setSuccess(true);
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

        <h1 className="mt-5 text-xl font-bold text-slate-900">รีเซ็ตรหัสผ่าน</h1>

        {tokenState === "verifying" && (
          <div className="mt-6 flex items-center gap-2 text-sm text-slate-500">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
            กำลังตรวจสอบลิงก์...
          </div>
        )}

        {tokenState === "invalid" && (
          <div className="mt-6 space-y-4">
            <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
              ลิงก์นี้หมดอายุหรือถูกใช้งานไปแล้ว กรุณาขอลิงก์รีเซ็ตรหัสผ่านใหม่อีกครั้ง
            </p>
            <Link
              href="/auth/forgot-password"
              className="flex h-10 w-full items-center justify-center rounded-lg bg-brand-600 text-sm font-semibold text-white shadow-sm shadow-brand-600/30 hover:bg-brand-700"
            >
              ขอลิงก์ใหม่
            </Link>
          </div>
        )}

        {tokenState === "valid" && (
          <>
            <p className="mt-1 text-xs text-slate-500">ตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณ</p>
            {success ? (
              <div className="mt-6 space-y-4">
                <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">รีเซ็ตรหัสผ่านสำเร็จ</div>
                <Link
                  href="/auth/login"
                  className="flex h-10 w-full items-center justify-center rounded-lg bg-brand-600 text-sm font-semibold text-white shadow-sm shadow-brand-600/30 hover:bg-brand-700"
                >
                  เข้าสู่ระบบ
                </Link>
              </div>
            ) : (
              <form onSubmit={submit} className="mt-6 space-y-3">
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">รหัสผ่านใหม่</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    placeholder="อย่างน้อย 8 ตัวอักษร"
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-brand-500"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">ยืนยันรหัสผ่าน</span>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password"
                    required
                    placeholder="กรอกรหัสผ่านอีกครั้ง"
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-brand-500"
                  />
                </label>
                {err && <p className="rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700">{err}</p>}
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="h-10 w-full rounded-lg bg-brand-600 text-sm font-semibold text-white shadow-sm shadow-brand-600/30 hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? "กำลังบันทึก..." : "บันทึกรหัสผ่านใหม่"}
                </button>
              </form>
            )}
          </>
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
