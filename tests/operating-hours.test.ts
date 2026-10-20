import { describe, it, expect, vi, beforeEach } from "vitest";

// ──────────────────────────────────────────────────────────────────────────────
// Unit tests for operating-hours utilities (pure logic, no DB)
// ──────────────────────────────────────────────────────────────────────────────

import { checkOperatingHours, nowBangkok } from "@/lib/services/operating-hours";
import { prisma } from "@/lib/prisma";

const mockPrisma = prisma as unknown as {
  holidayDate: { findFirst: ReturnType<typeof vi.fn> };
  operatingHours: { findMany: ReturnType<typeof vi.fn> };
};

// Freeze time to a known Bangkok weekday: Monday 2026-10-05 at 10:00 Bangkok time
// UTC equivalent: 03:00 UTC (Bangkok = UTC+7)
const MONDAY_10AM_UTC = new Date("2026-10-05T03:00:00.000Z");

beforeEach(() => {
  vi.setSystemTime(MONDAY_10AM_UTC);
  vi.clearAllMocks();
});

describe("nowBangkok", () => {
  it("returns Monday at 10:00 when system time is 03:00 UTC on Monday Oct 5 2026", () => {
    const result = nowBangkok();
    expect(result.dayOfWeek).toBe(1); // Monday
    expect(result.time).toBe("10:00");
    expect(result.dateStr).toBe("2026-10-05");
  });

  it("handles Saturday midnight in Bangkok (UTC Friday 17:00)", () => {
    vi.setSystemTime(new Date("2026-10-02T17:00:00.000Z")); // Sat 00:00 BKK
    const result = nowBangkok();
    expect(result.dayOfWeek).toBe(6); // Saturday
    expect(result.time).toBe("00:00");
  });
});

describe("checkOperatingHours", () => {
  it("returns isOpen=false on a holiday", async () => {
    mockPrisma.holidayDate.findFirst.mockResolvedValue({ id: "h1", name: "วันหยุดพิเศษ" });
    const result = await checkOperatingHours();
    expect(result.isOpen).toBe(false);
    expect(result.nextOpenAt).toContain("วันหยุด");
  });

  it("returns isOpen=true when current time is inside operating window", async () => {
    // Monday 10:00 BKK — window 09:00–11:30
    mockPrisma.holidayDate.findFirst.mockResolvedValue(null);
    mockPrisma.operatingHours.findMany.mockResolvedValue([
      { id: "oh1", dayOfWeek: 1, startTime: "09:00", endTime: "11:30", isActive: true },
    ]);
    const result = await checkOperatingHours();
    expect(result.isOpen).toBe(true);
  });

  it("returns isOpen=false when current time is before operating window opens", async () => {
    // Monday 10:00 BKK — window is 13:00–15:00 (later)
    mockPrisma.holidayDate.findFirst.mockResolvedValue(null);
    mockPrisma.operatingHours.findMany.mockResolvedValue([
      { id: "oh1", dayOfWeek: 1, startTime: "13:00", endTime: "15:00", isActive: true },
    ]);
    const result = await checkOperatingHours();
    expect(result.isOpen).toBe(false);
    expect(result.nextOpenAt).toBe("13:00 น.");
  });

  it("returns isOpen=false after last window of the day", async () => {
    // Monday 10:00 BKK — window was 08:00–09:30 (already closed)
    mockPrisma.holidayDate.findFirst.mockResolvedValue(null);
    mockPrisma.operatingHours.findMany.mockResolvedValue([
      { id: "oh1", dayOfWeek: 1, startTime: "08:00", endTime: "09:30", isActive: true },
    ]);
    const result = await checkOperatingHours();
    expect(result.isOpen).toBe(false);
    expect(result.nextOpenAt).toBe("วันทำการถัดไป");
  });

  it("returns isOpen=false on a day with no configured windows", async () => {
    mockPrisma.holidayDate.findFirst.mockResolvedValue(null);
    mockPrisma.operatingHours.findMany.mockResolvedValue([]);
    const result = await checkOperatingHours();
    expect(result.isOpen).toBe(false);
  });

  it("handles boundary: time exactly at endTime is considered closed", async () => {
    // Monday 11:30 BKK (window 09:00–11:30)
    vi.setSystemTime(new Date("2026-10-05T04:30:00.000Z")); // 11:30 BKK
    mockPrisma.holidayDate.findFirst.mockResolvedValue(null);
    mockPrisma.operatingHours.findMany.mockResolvedValue([
      { id: "oh1", dayOfWeek: 1, startTime: "09:00", endTime: "11:30", isActive: true },
    ]);
    const result = await checkOperatingHours();
    expect(result.isOpen).toBe(false); // endTime is exclusive
  });
});
