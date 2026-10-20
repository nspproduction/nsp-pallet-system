import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/auth/current-user";
import type { SessionUser } from "@/lib/auth/current-user";

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------

export interface HoursInput {
  dayOfWeek: number; // 0=Sun 1=Mon … 6=Sat
  startTime: string; // "09:00"
  endTime: string;   // "11:30"
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
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) => bkk.find((p) => p.type === type)?.value ?? "";
  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
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
  const { dayOfWeek, time } = nowBangkok();

  // Check holiday
  const today = new Date();
  const startOfDay = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const holiday = await prisma.holidayDate.findFirst({
    where: { date: startOfDay, isActive: true },
  });
  if (holiday) return { isOpen: false, nextOpenAt: `วันหยุด: ${holiday.name}` };

  const hours = await prisma.operatingHours.findMany({
    where: { dayOfWeek, isActive: true },
    orderBy: { startTime: "asc" },
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
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });
}

export async function createOperatingHours(user: SessionUser, input: HoursInput) {
  if (!user.roles.includes("ADMIN")) throw new HttpError(403, "เฉพาะ Admin เท่านั้น");
  validateTimeRange(input);
  return prisma.operatingHours.create({ data: { ...input, label: input.label ?? null } });
}

export async function updateOperatingHours(user: SessionUser, id: string, input: Partial<HoursInput>) {
  if (!user.roles.includes("ADMIN")) throw new HttpError(403, "เฉพาะ Admin เท่านั้น");
  if (input.startTime && input.endTime) validateTimeRange(input as HoursInput);
  return prisma.operatingHours.update({ where: { id }, data: input });
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
    orderBy: { date: "asc" },
  });
}

export async function createHoliday(user: SessionUser, date: Date, name: string) {
  if (!user.roles.includes("ADMIN")) throw new HttpError(403, "เฉพาะ Admin เท่านั้น");
  return prisma.holidayDate.create({ data: { date, name } });
}

export async function deleteHoliday(user: SessionUser, id: string) {
  if (!user.roles.includes("ADMIN")) throw new HttpError(403, "เฉพาะ Admin เท่านั้น");
  await prisma.holidayDate.update({ where: { id }, data: { isActive: false } });
}
