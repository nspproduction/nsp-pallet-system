"use client";

import { useState } from "react";
import { twMerge } from "tailwind-merge";

interface HoursRow { id: string; dayOfWeek: number; startTime: string; endTime: string; label: string | null }
interface HolidayRow { id: string; date: string | Date; name: string }

const DAY_LABELS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัส", "ศุกร์", "เสาร์"];
const INPUT = "h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-brand-500";
const ERR_CLS = "rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700";

const HOURS_DEFAULTS = { dayOfWeek: 1, startTime: "09:00", endTime: "11:30", label: "" };
const HOLIDAY_DEFAULTS = { date: "", name: "" };

async function parseErrorMessage(res: Response, fallback: string): Promise<string> {
  const data = await res.json().catch(() => ({}));
  return data.error ?? fallback;
}

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
  const [dayOfWeek, setDayOfWeek] = useState(HOURS_DEFAULTS.dayOfWeek);
  const [startTime, setStartTime] = useState(HOURS_DEFAULTS.startTime);
  const [endTime, setEndTime] = useState(HOURS_DEFAULTS.endTime);
  const [label, setLabel] = useState(HOURS_DEFAULTS.label);
  const [holidayDate, setHolidayDate] = useState(HOLIDAY_DEFAULTS.date);
  const [holidayName, setHolidayName] = useState(HOLIDAY_DEFAULTS.name);
  const [busy, setBusy] = useState(false);

  function resetHoursForm() {
    setDayOfWeek(HOURS_DEFAULTS.dayOfWeek);
    setStartTime(HOURS_DEFAULTS.startTime);
    setEndTime(HOURS_DEFAULTS.endTime);
    setLabel(HOURS_DEFAULTS.label);
  }
  function resetHolidayForm() {
    setHolidayDate(HOLIDAY_DEFAULTS.date);
    setHolidayName(HOLIDAY_DEFAULTS.name);
  }

  async function reloadHours() {
    try {
      const res = await fetch("/api/operating-hours");
      if (!res.ok) {
        setErr(await parseErrorMessage(res, "โหลดข้อมูลไม่สำเร็จ"));
        return;
      }
      setHours(await res.json());
    } catch {
      setErr("โหลดข้อมูลไม่สำเร็จ");
    }
  }

  async function reloadHolidays() {
    try {
      const res = await fetch("/api/operating-hours/holidays");
      if (!res.ok) {
        setErr(await parseErrorMessage(res, "โหลดข้อมูลไม่สำเร็จ"));
        return;
      }
      setHolidays(await res.json());
    } catch {
      setErr("โหลดข้อมูลไม่สำเร็จ");
    }
  }

  async function saveHours() {
    setBusy(true); setErr(null);
    const res = await fetch("/api/operating-hours", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dayOfWeek, startTime, endTime, label: label || null }),
    });
    setBusy(false);
    if (!res.ok) {
      setErr(await parseErrorMessage(res, "บันทึกไม่สำเร็จ"));
      return;
    }
    setShowForm(false);
    resetHoursForm();
    await reloadHours();
  }

  async function deleteHours(id: string) {
    setErr(null);
    try {
      const res = await fetch(`/api/operating-hours/${id}`, { method: "DELETE" });
      if (!res.ok) {
        setErr(await parseErrorMessage(res, "ลบไม่สำเร็จ"));
        return;
      }
      await reloadHours();
    } catch {
      setErr("ลบไม่สำเร็จ");
    }
  }

  async function saveHoliday() {
    setBusy(true); setErr(null);
    const res = await fetch("/api/operating-hours/holidays", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date: holidayDate, name: holidayName }),
    });
    setBusy(false);
    if (!res.ok) {
      setErr(await parseErrorMessage(res, "บันทึกไม่สำเร็จ"));
      return;
    }
    setShowHolidayForm(false);
    resetHolidayForm();
    await reloadHolidays();
  }

  async function deleteHoliday(id: string) {
    setErr(null);
    try {
      const res = await fetch(`/api/operating-hours/holidays/${id}`, { method: "DELETE" });
      if (!res.ok) {
        setErr(await parseErrorMessage(res, "ลบไม่สำเร็จ"));
        return;
      }
      await reloadHolidays();
    } catch {
      setErr("ลบไม่สำเร็จ");
    }
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
      {err && <p className={ERR_CLS}>{err}</p>}

      {/* Operating hours section */}
      <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">ช่วงเวลาทำรายการรายวัน</h2>
            <p className="mt-0.5 text-sm text-slate-500">เพิ่มได้หลายช่วงต่อวัน เช่น เช้า 09:00–11:30 และบ่าย 13:00–15:00</p>
          </div>
          <button
            type="button"
            onClick={() => { setShowForm(true); setErr(null); }}
            className="h-9 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
          >
            + เพิ่มช่วงเวลา
          </button>
        </div>

        {hours.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
            <p className="text-sm font-medium text-slate-600">ยังไม่ได้กำหนดช่วงเวลา</p>
            <p className="mt-1 text-xs text-amber-600">
              ⚠️ เมื่อไม่มีช่วงเวลา — ผู้ใช้จะไม่สามารถสร้างคำขอได้
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
                          type="button"
                          onClick={() => deleteHours(r.id)}
                          aria-label="ลบ"
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
              <button
                type="button"
                onClick={() => { setShowForm(false); resetHoursForm(); setErr(null); }}
                className="h-9 rounded-lg border border-slate-200 px-4 text-sm text-slate-600"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={saveHours}
                disabled={busy}
                className="h-9 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white disabled:opacity-50"
              >
                {busy ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Holiday section */}
      <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">วันหยุดพิเศษ</h2>
            <p className="mt-0.5 text-sm text-slate-500">วันที่กำหนดไว้จะไม่สามารถสร้างคำขอได้ทั้งวัน</p>
          </div>
          <button
            type="button"
            onClick={() => { setShowHolidayForm(true); setErr(null); }}
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
                <button
                  type="button"
                  onClick={() => deleteHoliday(h.id)}
                  className="text-xs text-rose-500 hover:text-rose-700"
                >
                  ลบ
                </button>
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
              <button
                type="button"
                onClick={() => { setShowHolidayForm(false); resetHolidayForm(); setErr(null); }}
                className="h-9 rounded-lg border border-slate-200 px-4 text-sm text-slate-600"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={saveHoliday}
                disabled={busy || !holidayDate || !holidayName.trim()}
                className="h-9 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white disabled:opacity-50"
              >
                {busy ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
