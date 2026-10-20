import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/auth/current-user";
import type { SessionUser } from "@/lib/auth/current-user";

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------

export interface HoursInput {
  dayOfWeek: number; // 0=Sun 1=Mon … 6=Sat
  startTime: string; // "09:00"
  endTime: string; // "11:30"
  label?: string | null;
}

// -----------------------------------------------------------------------
// Time utilities (Asia/Bangkok)
// -----------------------------------------------------------------------

const BKK_TZ = "Asia/Bangkok";

/** Return current date/time in Bangkok timezone as a { date, time } object */
export function nowBangkok(): { dayOfWeek: number; time: string; dateStr: string } {
  const now = new Date();
  const bkk = new Intl.DateTimeFormat("en-US", {
    timeZone: BKK_TZ,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
    // hour12: false,
  }).formatToParts(now);

  const get = (type: string) => bkk.find((p) => p.type === type)?.value ?? "";
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6
  };
  const dayOfWeek = weekdayMap[get("weekday")] ?? 0;
  const hour = get("hour").padStart(2, "0");
  const minute = get("minute").padStart(2, "0");
  const time = `${hour}:${minute}`;
  const dateStr = `${get("year")}-${get("month")}-${get("day")}`;

  return { dayOfWeek, time, dateStr };
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

// -----------------------------------------------------------------------
// Core check
// -----------------------------------------------------------------------

export interface OperatingStatus {
  isOpen: boolean;
  nextOpenAt?: string; // human-readable hint
}

/** Check whether the current Bangkok time falls within any active operating window. */
export async function checkOperatingHours(): Promise<OperatingStatus> {
  const { dayOfWeek, time, dateStr } = nowBangkok();

  // Compare against the Bangkok "today" date, not the server's local date.
  // HolidayDate.date is @db.Date which is stored as UTC midnight for that calendar day.
  const [y, m, d] = dateStr.split("-").map(Number);
  const bkkToday = new Date(Date.UTC(y, m - 1, d));
  const holiday = await prisma.holidayDate.findFirst({
    where: { date: bkkToday, isActive: true }
  });
  if (holiday) return { isOpen: false, nextOpenAt: `วันหยุด: ${holiday.name}` };

  const hours = await prisma.operatingHours.findMany({
    where: { dayOfWeek, isActive: true },
    orderBy: { startTime: "asc" }
  });

  const currentMin = timeToMinutes(time);
  for (const h of hours) {
    if (currentMin >= timeToMinutes(h.startTime) && currentMin < timeToMinutes(h.endTime)) {
      return { isOpen: true };
    }
  }

  // Find next open window (same day or coming days)
  const later = hours.find((h) => timeToMinutes(h.startTime) > currentMin);
  if (later) return { isOpen: false, nextOpenAt: `${later.startTime} น.` };

  return { isOpen: false, nextOpenAt: "วันทำการถัดไป" };
}

// -----------------------------------------------------------------------
// CRUD (admin only)
// -----------------------------------------------------------------------

export async function listOperatingHours() {
  return prisma.operatingHours.findMany({
    where: { isActive: true },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }]
  });
}

export async function createOperatingHours(user: SessionUser, input: HoursInput) {
  if (!user.roles.includes("ADMIN")) throw new HttpError(403, "เฉพาะ Admin เท่านั้น");
  validateTimeRange(input);
  await assertNoOverlap(input.dayOfWeek, input.startTime, input.endTime);
  return prisma.operatingHours.create({ data: { ...input, label: input.label ?? null } });
}

export async function updateOperatingHours(user: SessionUser, id: string, input: Partial<HoursInput>) {
  if (!user.roles.includes("ADMIN")) throw new HttpError(403, "เฉพาะ Admin เท่านั้น");
  if (input.startTime && input.endTime) validateTimeRange(input as HoursInput);
  // If the time or day is changing, re-check overlap against siblings (excluding self).
  if (input.startTime || input.endTime || input.dayOfWeek !== undefined) {
    const current = await prisma.operatingHours.findUnique({ where: { id } });
    if (!current) throw new HttpError(404, "ไม่พบช่วงเวลา");
    await assertNoOverlap(
      input.dayOfWeek ?? current.dayOfWeek,
      input.startTime ?? current.startTime,
      input.endTime ?? current.endTime,
      id,
    );
  }
  return prisma.operatingHours.update({ where: { id }, data: input });
}

async function assertNoOverlap(dayOfWeek: number, startTime: string, endTime: string, excludeId?: string) {
  const siblings = await prisma.operatingHours.findMany({
    where: { dayOfWeek, isActive: true, ...(excludeId ? { id: { not: excludeId } } : {}) }
  });
  const newStart = timeToMinutes(startTime);
  const newEnd = timeToMinutes(endTime);
  for (const h of siblings) {
    const es = timeToMinutes(h.startTime);
    const ee = timeToMinutes(h.endTime);
    // overlap when newStart < existing.end AND newEnd > existing.start
    if (newStart < ee && newEnd > es) {
      throw new HttpError(400, `ช่วงเวลาซ้อนกับช่วงเวลาเดิม ${h.startTime}–${h.endTime}`);
    }
  }
}

export async function deleteOperatingHours(user: SessionUser, id: string) {
  if (!user.roles.includes("ADMIN")) throw new HttpError(403, "เฉพาะ Admin เท่านั้น");
  await prisma.operatingHours.update({ where: { id }, data: { isActive: false } });
}

function validateTimeRange(input: HoursInput) {
  if (!/^\d{2}:\d{2}$/.test(input.startTime) || !/^\d{2}:\d{2}$/.test(input.endTime)) {
    throw new HttpError(400, "รูปแบบเวลาต้องเป็น HH:MM");
  }
  if (timeToMinutes(input.startTime) >= timeToMinutes(input.endTime)) {
    throw new HttpError(400, "startTime ต้องน้อยกว่า endTime");
  }
  if (input.dayOfWeek < 0 || input.dayOfWeek > 6) {
    throw new HttpError(400, "dayOfWeek ต้องอยู่ระหว่าง 0–6");
  }
}

// -----------------------------------------------------------------------
// Holiday CRUD (admin only)
// -----------------------------------------------------------------------

export async function listHolidays() {
  return prisma.holidayDate.findMany({
    where: { isActive: true },
    orderBy: { date: "asc" }
  });
}

export async function createHoliday(user: SessionUser, date: Date, name: string) {
  if (!user.roles.includes("ADMIN")) throw new HttpError(403, "เฉพาะ Admin เท่านั้น");
  const existing = await prisma.holidayDate.findFirst({ where: { date, isActive: true } });
  if (existing) {
    throw new HttpError(400, `มีวันหยุดในวันนี้แล้ว: ${existing.name}`);
  }
  return prisma.holidayDate.create({ data: { date, name: name.trim() } });
}

export async function deleteHoliday(user: SessionUser, id: string) {
  if (!user.roles.includes("ADMIN")) throw new HttpError(403, "เฉพาะ Admin เท่านั้น");
  await prisma.holidayDate.update({ where: { id }, data: { isActive: false } });
}
