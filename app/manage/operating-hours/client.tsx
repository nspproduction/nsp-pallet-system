"use client";

import { useState } from "react";
import { twMerge } from "tailwind-merge";

interface HoursRow { id: string; dayOfWeek: number; startTime: string; endTime: string; label: string | null }
interface HolidayRow { id: string; date: string | Date; name: string }

const DAY_LABELS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัส", "ศุกร์", "เสาร์"];
const INPUT = "h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-brand-500";

export function OperatingHoursClient({
  hours: initial,
  holidays: initialHolidays,
}: {
  hours: HoursRow[];
  holidays: HolidayRow[];
}) {
  const [hours, setHours] = useState<HoursRow[]>(initial);
  const [holidays, setHolidays] = useState<HolidayRow[]>(initialHolidays);
  const [showForm, setShowForm] = useState(false);
  const [showHolidayForm, setShowHolidayForm] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // form state
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("11:30");
  const [label, setLabel] = useState("");
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayName, setHolidayName] = useState("");
  const [busy, setBusy] = useState(false);

  async function reloadHours() {
    const res = await fetch("/api/operating-hours");
    if (res.ok) setHours(await res.json());
  }

  async function saveHours() {
    setBusy(true); setErr(null);
    const res = await fetch("/api/operating-hours", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dayOfWeek, startTime, endTime, label: label || null }),
    });
    setBusy(false);
    if (!res.ok) { setErr((await res.json().catch(() => ({}))).error ?? "บันทึกไม่สำเร็จ"); return; }
    setShowForm(false); setLabel("");
    await reloadHours();
  }

  async function deleteHours(id: string) {
    await fetch(`/api/operating-hours/${id}`, { method: "DELETE" });
    await reloadHours();
  }

  async function saveHoliday() {
    setBusy(true); setErr(null);
    const res = await fetch("/api/operating-hours/holidays", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date: holidayDate, name: holidayName }),
    });
    setBusy(false);
    if (!res.ok) { setErr((await res.json().catch(() => ({}))).error ?? "บันทึกไม่สำเร็จ"); return; }
    setShowHolidayForm(false); setHolidayDate(""); setHolidayName("");
    const h = await fetch("/api/operating-hours/holidays");
    if (h.ok) setHolidays(await h.json());
  }

  async function deleteHoliday(id: string) {
    await fetch(`/api/operating-hours/holidays/${id}`, { method: "DELETE" });
    const h = await fetch("/api/operating-hours/holidays");
    if (h.ok) setHolidays(await h.json());
  }

  // Group hours by day
  const byDay = new Map<number, HoursRow[]>();
  for (const h of hours) {
    const list = byDay.get(h.dayOfWeek) ?? [];
    list.push(h);
    byDay.set(h.dayOfWeek, list);
  }

  return (
    <div className="space-y-6">
      {/* Operating hours section */}
      <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">ช่วงเวลาทำรายการรายวัน</h2>
            <p className="mt-0.5 text-sm text-slate-500">เพิ่มได้หลายช่วงต่อวัน เช่น เช้า 09:00–11:30 และบ่าย 13:00–15:00</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="h-9 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
          >
            + เพิ่มช่วงเวลา
          </button>
        </div>

        {err && <p className="mt-3 rounded-lg bg-rose-50 p-2 text-sm text-rose-700">{err}</p>}

        {hours.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
            <p className="text-sm font-medium text-slate-600">ยังไม่ได้กำหนดช่วงเวลา</p>
            <p className="mt-1 text-xs text-amber-600">
              ⚠️ เมื่อไม่มีช่วงเวลา — ผู้ใช้จะส่งได้เฉพาะคำขอด่วนเท่านั้น
            </p>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => {
              const rows = byDay.get(d) ?? [];
              if (!rows.length) return null;
              return (
                <div key={d} className="flex items-start gap-4 rounded-xl bg-slate-50 px-4 py-3">
                  <p className="w-20 shrink-0 text-sm font-semibold text-slate-700">{DAY_LABELS[d]}</p>
                  <div className="flex flex-1 flex-wrap gap-2">
                    {rows.map((r) => (
                      <span
                        key={r.id}
                        className="flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-800"
                      >
                        {r.startTime}–{r.endTime}
                        {r.label && <span className="text-brand-500">({r.label})</span>}
                        <button
                          onClick={() => deleteHours(r.id)}
                          className="ml-1 text-brand-400 hover:text-rose-600"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {showForm && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <p className="text-sm font-medium text-slate-700">เพิ่มช่วงเวลาใหม่</p>
            <div className="flex flex-wrap gap-3">
              <label className="block">
                <span className="text-xs text-slate-500">วัน</span>
                <select value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))} className={twMerge(INPUT, "mt-0.5 w-28")}>
                  {DAY_LABELS.map((l, i) => <option key={i} value={i}>{l}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-xs text-slate-500">เริ่ม</span>
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={twMerge(INPUT, "mt-0.5 w-28")} />
              </label>
              <label className="block">
                <span className="text-xs text-slate-500">สิ้นสุด</span>
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={twMerge(INPUT, "mt-0.5 w-28")} />
              </label>
              <label className="block">
                <span className="text-xs text-slate-500">ชื่อช่วง (ไม่บังคับ)</span>
                <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="เช่น ช่วงเช้า" className={twMerge(INPUT, "mt-0.5 w-32")} />
              </label>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowForm(false)} className="h-9 rounded-lg border border-slate-200 px-4 text-sm text-slate-600">ยกเลิก</button>
              <button onClick={saveHours} disabled={busy} className="h-9 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white disabled:opacity-50">บันทึก</button>
            </div>
          </div>
        )}
      </div>

      {/* Holiday section */}
      <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">วันหยุดพิเศษ</h2>
            <p className="mt-0.5 text-sm text-slate-500">วันที่กำหนดไว้จะไม่สามารถส่งคำขอปกติได้ทั้งวัน</p>
          </div>
          <button
            onClick={() => setShowHolidayForm(true)}
            className="h-9 rounded-lg bg-slate-100 px-4 text-sm font-medium text-slate-700 hover:bg-slate-200"
          >
            + เพิ่มวันหยุด
          </button>
        </div>

        {holidays.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">ยังไม่มีวันหยุดพิเศษ</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {holidays.map((h) => (
              <li key={h.id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-2">
                <div>
                  <p className="text-sm font-medium text-slate-800">{h.name}</p>
                  <p className="text-xs text-slate-500">{new Date(String(h.date)).toLocaleDateString("th-TH", { dateStyle: "long" })}</p>
                </div>
                <button onClick={() => deleteHoliday(h.id)} className="text-xs text-rose-500 hover:text-rose-700">ลบ</button>
              </li>
            ))}
          </ul>
        )}

        {showHolidayForm && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <p className="text-sm font-medium text-slate-700">เพิ่มวันหยุด</p>
            <div className="flex flex-wrap gap-3">
              <label className="block">
                <span className="text-xs text-slate-500">วันที่</span>
                <input type="date" value={holidayDate} onChange={(e) => setHolidayDate(e.target.value)} className={twMerge(INPUT, "mt-0.5")} />
              </label>
              <label className="block flex-1">
                <span className="text-xs text-slate-500">ชื่อวันหยุด</span>
                <input value={holidayName} onChange={(e) => setHolidayName(e.target.value)} placeholder="เช่น วันสงกรานต์" className={twMerge(INPUT, "mt-0.5 w-full")} />
              </label>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowHolidayForm(false)} className="h-9 rounded-lg border border-slate-200 px-4 text-sm text-slate-600">ยกเลิก</button>
              <button onClick={saveHoliday} disabled={busy || !holidayDate || !holidayName} className="h-9 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white disabled:opacity-50">บันทึก</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
