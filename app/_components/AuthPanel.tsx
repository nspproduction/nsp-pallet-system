"use client";

// Library
import { useEffect, useState } from "react";

// Components
import { Skeleton } from "./ui";

interface Me {
  authenticated: boolean;
  user?: { id: string; fullName: string; role: string; status: string };
}

interface DevUser {
  employeeCode: string;
  fullName: string;
  role: string;
  department?: { code: string; name: string } | null;
}

export function AuthPanel({ devMode }: { devMode: boolean }) {
  const [me, setMe] = useState<Me | null>(null);
  const [devUsers, setDevUsers] = useState<DevUser[]>([]);
  const [employeeCode, setEmployeeCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then(setMe)
      .catch(() => setMe({ authenticated: false }));
  }, []);

  useEffect(() => {
    if (!devMode) return;
    void (async () => {
      try {
        const res = await fetch("/api/auth/dev-users");
        if (!res.ok) return;
        const list = (await res.json()) as DevUser[];
        setDevUsers(list);
        if (list.length > 0) setEmployeeCode(list[0].employeeCode);
      } catch {
        // ignore
      }
    })();
  }, [devMode]);

  async function login() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/dev-login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ employeeCode }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "login failed");
      }
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.reload();
  }

  if (!me) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-2.5 w-20" />
        </div>
        <Skeleton className="h-8 w-20 rounded-lg" />
      </div>
    );
  }

  if (me.authenticated && me.user) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-brand-200 bg-brand-50/60 px-4 py-3 text-sm">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-600 text-white font-semibold">
          {me.user.fullName[0]}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-slate-900">{me.user.fullName}</p>
          <p className="text-xs text-slate-500">
            {me.user.role} · {me.user.status}
          </p>
        </div>
        <button
          onClick={logout}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          ออกจากระบบ
        </button>
      </div>
    );
  }

  if (!devMode) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-sm">
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">
        DEV login (localhost เท่านั้น)
      </p>
      <p className="mt-1 text-xs text-slate-600">
        เลือกผู้ใช้ตัวอย่างจาก seed เพื่อทดสอบระบบ (บน prod ใช้ LINE login ผ่าน /liff)
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={employeeCode}
          onChange={(e) => setEmployeeCode(e.target.value)}
          disabled={devUsers.length === 0}
          className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm disabled:bg-slate-50 disabled:text-slate-400"
        >
          {devUsers.length === 0 ? (
            <option value="">— ไม่มี user ที่ ACTIVE —</option>
          ) : (
            devUsers.map((u) => (
              <option key={u.employeeCode} value={u.employeeCode}>
                {u.employeeCode} · {u.fullName} ({u.role}
                {u.department ? ` · ${u.department.code}` : ""})
              </option>
            ))
          )}
        </select>
        <button
          onClick={login}
          disabled={busy || !employeeCode}
          className="h-9 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? "กำลังเข้า..." : "เข้าใช้งาน"}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
