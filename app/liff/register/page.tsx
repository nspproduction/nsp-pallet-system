"use client";

// Library
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { twMerge } from "tailwind-merge";

// Components
import { LiffTopBar } from "../_shared";
import { Skeleton } from "@/app/_components/ui";

// Lib
import { safeFetchJson } from "../_fetch";

interface Department {
  id: string;
  code: string;
  name: string;
  active: boolean;
}

interface Section {
  id: string;
  code: string;
  name: string;
  active: boolean;
  departmentId: string;
}

interface MeResponse {
  authenticated: boolean;
  needsRegistration?: boolean;
  user?: {
    fullName: string;
    phone?: string | null;
    departmentId?: string | null;
    sectionId?: string | null;
    status: string;
  };
}

const INPUT_BASE =
  "w-full h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-brand-500";

export default function RegisterPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [sections, setSections] = useState<Section[]>([]);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [sectionId, setSectionId] = useState("");

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const [meRes, deptRes] = await Promise.all([
        safeFetchJson<MeResponse>("/api/auth/me"),
        safeFetchJson<Department[]>("/api/departments"),
      ]);
      if (meRes.data) {
        setMe(meRes.data);
        setFullName(meRes.data.user?.fullName && meRes.data.user.fullName !== "ยังไม่ได้ลงทะเบียน" ? meRes.data.user.fullName : "");
        setPhone(meRes.data.user?.phone ?? "");
        setDepartmentId(meRes.data.user?.departmentId ?? "");
        setSectionId(meRes.data.user?.sectionId ?? "");
      } else {
        setMe({ authenticated: false });
      }
      setDepartments((deptRes.data ?? []).filter((d) => d.active));
    })();
  }, []);

  // Fetch sections when department changes
  useEffect(() => {
    if (!departmentId) {
      setSections([]);
      return;
    }
    void (async () => {
      const res = await safeFetchJson<Section[]>(`/api/sections?departmentId=${departmentId}`);
      setSections((res.data ?? []).filter((s) => s.active));
    })();
  }, [departmentId]);

  // Clear section if dept changes to one without
  useEffect(() => {
    if (sectionId && !sections.some((s) => s.id === sectionId)) {
      setSectionId("");
    }
  }, [sections, sectionId]);

  const canSubmit = useMemo(
    () => fullName.trim().length > 0 && phone.trim().length > 0 && departmentId.length > 0 && !busy,
    [fullName, phone, departmentId, busy],
  );

  async function submit() {
    setErr(null);
    setBusy(true);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fullName: fullName.trim(),
        phone: phone.trim(),
        departmentId,
        sectionId: sectionId || null,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErr(data.error ?? "ลงทะเบียนไม่สำเร็จ");
      return;
    }
    router.replace("/liff");
  }

  if (!me) {
    return (
      <div>
        <LiffTopBar title="ลงทะเบียน" backHref="/liff" />
        <div className="space-y-4 p-4">
          <Skeleton className="h-11 w-full rounded-lg" />
          <Skeleton className="h-11 w-full rounded-lg" />
          <Skeleton className="h-11 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <LiffTopBar title="ลงทะเบียน" backHref="/liff" />
      <div className="space-y-5 p-4 pb-32">
        <div className="rounded-2xl border border-brand-200 bg-brand-50/60 p-4 text-sm text-brand-900">
          <p className="font-semibold">ยินดีต้อนรับ</p>
          <p className="mt-1 text-xs leading-relaxed">
            กรุณากรอกข้อมูลให้ครบ หลังจากกดลงทะเบียน แอดมินจะเป็นผู้อนุมัติให้คุณใช้งานระบบ
          </p>
        </div>

        <label className="block">
          <span className="text-xs font-medium text-slate-600">ชื่อ-นามสกุล</span>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="ชื่อจริง นามสกุลจริง"
            className={twMerge(INPUT_BASE, "mt-1")}
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-slate-600">เบอร์โทร</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="08x-xxx-xxxx"
            inputMode="tel"
            className={twMerge(INPUT_BASE, "mt-1")}
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-slate-600">แผนก</span>
          <select
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            className={twMerge(INPUT_BASE, "mt-1")}
          >
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
            <span className="text-xs font-medium text-slate-600">Section</span>
            <select
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
              className={twMerge(INPUT_BASE, "mt-1")}
            >
              <option value="">- เลือก section (ถ้ามี) -</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {err && <p className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{err}</p>}
      </div>

      <div className="fixed bottom-0 left-1/2 z-20 w-full max-w-md -translate-x-1/2 border-t border-border bg-white p-4">
        <button
          onClick={submit}
          disabled={!canSubmit}
          className="h-12 w-full rounded-xl bg-brand-600 text-sm font-semibold text-white shadow-sm shadow-brand-600/30 disabled:opacity-50"
        >
          {busy ? "กำลังส่ง..." : "ลงทะเบียน"}
        </button>
      </div>
    </div>
  );
}
