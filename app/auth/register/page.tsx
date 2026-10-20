"use client";

import { startTransition, useEffect, useState } from "react";
import Link from "next/link";
import { twMerge } from "tailwind-merge";

interface Department {
  id: string;
  name: string;
  active: boolean;
}
interface Section {
  id: string;
  name: string;
  active: boolean;
  departmentId: string;
}

const INPUT = "w-full h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-brand-500";
const LABEL = "text-xs font-medium text-slate-600";

export default function RegisterPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [sections, setSections] = useState<Section[]>([]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [sectionId, setSectionId] = useState("");

  const [busy, setBusy] = useState(false);
  const [sectionsLoading, setSectionsLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch("/api/departments")
      .then((r) => r.json())
      .then((data: Department[]) => setDepartments(data.filter((d) => d.active)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!departmentId) {
      startTransition(() => setSections([]));
      return;
    }
    startTransition(() => setSectionsLoading(true));
    void fetch(`/api/sections?departmentId=${departmentId}`)
      .then((r) => r.json())
      .then((data: Section[]) => setSections(data.filter((s) => s.active)))
      .catch(() => setSections([]))
      .finally(() => setSectionsLoading(false));
  }, [departmentId]);

  useEffect(() => {
    if (sectionId && !sections.some((s) => s.id === sectionId)) {
      startTransition(() => setSectionId(""));
    }
  }, [sections, sectionId]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    if (password !== confirmPw) {
      setErr("รหัสผ่านทั้งสองช่องไม่ตรงกัน");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        phone: phone.trim(),
        departmentId,
        sectionId: sectionId || null
      })
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErr((data as { error?: string }).error ?? "สมัครไม่สำเร็จ กรุณาลองใหม่");
      return;
    }
    setSuccess(true);
  }

  if (success) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-3xl">✓</div>
        <h2 className="mt-4 text-lg font-bold text-slate-900">สมัครสำเร็จ</h2>
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-slate-600">
          บัญชีของคุณอยู่ระหว่างรอการตรวจสอบจาก Admin คุณจะได้รับอีเมลแจ้งผลเมื่อการอนุมัติเสร็จสิ้น
        </p>
        <Link
          href="/auth/login"
          className="mt-6 inline-block rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-600/30"
        >
          ไปหน้าเข้าสู่ระบบ
        </Link>
      </div>
    );
  }

  const sectionRequired = !sectionsLoading && sections.length > 0;
  const canSubmit =
    !busy && !sectionsLoading && email && password && confirmPw && fullName && phone && departmentId && (!sectionRequired || sectionId);

  return (
    <div className="min-h-screen bg-surface">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-white shadow-sm">
        <header className="flex items-center gap-3 border-b border-border px-4 py-4">
          <Link href="/auth/login" className="text-slate-500 hover:text-slate-800">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <h1 className="text-base font-semibold text-slate-900">สมัครใช้งาน</h1>
        </header>

        <form onSubmit={submit} className="flex flex-col gap-4 p-4 pb-32">
          <p className="rounded-xl border border-brand-200 bg-brand-50/60 px-4 py-3 text-xs text-brand-900">
            กรอกข้อมูลให้ครบถ้วน หลังสมัครแล้ว Admin จะตรวจสอบและเปิดสิทธิ์การใช้งาน
          </p>

          <fieldset className="space-y-3 rounded-xl border border-slate-100 p-4">
            <legend className="px-1 text-xs font-semibold text-brand-500">ข้อมูลสำหรับเข้าสู่ระบบ</legend>

            <label className="block">
              <span className={LABEL}>
                อีเมล <span className="text-rose-500">*</span>
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@company.com"
                autoComplete="email"
                className={twMerge(INPUT, "mt-1")}
                required
              />
            </label>

            <label className="block">
              <span className={LABEL}>
                รหัสผ่าน <span className="text-rose-500">*</span>
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="อย่างน้อย 8 ตัวอักษร"
                autoComplete="new-password"
                className={twMerge(INPUT, "mt-1")}
                required
              />
            </label>

            <label className="block">
              <span className={LABEL}>
                ยืนยันรหัสผ่าน <span className="text-rose-500">*</span>
              </span>
              <input
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="พิมพ์รหัสผ่านอีกครั้ง"
                autoComplete="new-password"
                className={twMerge(INPUT, "mt-1", confirmPw && confirmPw !== password ? "border-rose-400" : "")}
                required
              />
              {confirmPw && confirmPw !== password && <span className="mt-0.5 block text-[10px] text-rose-500">รหัสผ่านไม่ตรงกัน</span>}
            </label>
          </fieldset>

          <fieldset className="space-y-3 rounded-xl border border-slate-100 p-4">
            <legend className="px-1 text-xs font-semibold text-brand-500">ข้อมูลส่วนตัว</legend>

            <label className="block">
              <span className={LABEL}>
                ชื่อ-นามสกุล <span className="text-rose-500">*</span>
              </span>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="ชื่อจริง นามสกุลจริง"
                className={twMerge(INPUT, "mt-1")}
                required
              />
            </label>

            <label className="block">
              <span className={LABEL}>
                เบอร์โทร <span className="text-rose-500">*</span>
              </span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="08x-xxx-xxxx"
                inputMode="tel"
                className={twMerge(INPUT, "mt-1")}
                required
              />
            </label>
          </fieldset>

          <fieldset className="space-y-3 rounded-xl border border-slate-100 p-4">
            <legend className="px-1 text-xs font-semibold text-brand-500">แผนก</legend>

            <label className="block">
              <span className={LABEL}>
                แผนก <span className="text-rose-500">*</span>
              </span>
              <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className={twMerge(INPUT, "mt-1")} required>
                <option value="">- เลือกแผนก -</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>

            {sections.length > 0 && (
              <label className="block">
                <span className={LABEL}>
                  Section <span className="text-rose-500">*</span>
                </span>
                <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} className={twMerge(INPUT, "mt-1")}>
                  <option value="">- เลือก section -</option>
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </fieldset>

          {err && <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{err}</div>}
        </form>

        <div className="fixed bottom-0 left-1/2 z-20 w-full max-w-md -translate-x-1/2 border-t border-border bg-white p-4">
          <button
            onClick={(e) => {
              e.preventDefault();
              (document.querySelector("form") as HTMLFormElement | null)?.requestSubmit();
            }}
            disabled={!canSubmit}
            className="h-12 w-full rounded-xl bg-brand-600 text-sm font-semibold text-white shadow-sm shadow-brand-600/30 disabled:opacity-50"
          >
            {busy ? "กำลังส่ง..." : "สมัครใช้งาน"}
          </button>
        </div>
      </div>
    </div>
  );
}
