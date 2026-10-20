import { describe, it, expect, vi, beforeEach } from "vitest";

// ──────────────────────────────────────────────────────────────────────────────
// Unit tests for warehouse service helpers
// ──────────────────────────────────────────────────────────────────────────────

import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth/current-user";

const mockPrisma = prisma as unknown as {
  department: { findUnique: ReturnType<typeof vi.fn>; findFirst: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
  $queryRaw: ReturnType<typeof vi.fn>;
  auditLog: { create: ReturnType<typeof vi.fn> };
};

const PM_USER = { id: "u1", roles: ["PALLET_MANAGER"], fullName: "PM", status: "ACTIVE" } as unknown as SessionUser;

// Shared txMock factory for tests that need moveStock to succeed (1 row updated on outflow)
function makeTxMock(executeRawResult = 1) {
  return {
    warehouseOperation: { create: vi.fn().mockResolvedValue({}) },
    stockMovement: { create: vi.fn().mockResolvedValue({}) },
    $executeRaw: vi.fn().mockResolvedValue(executeRawResult),
    warehouseStock: { findUnique: vi.fn().mockResolvedValue({ quantity: 0 }) },
  };
}

beforeEach(() => vi.clearAllMocks());

describe("repairPallets input validation", () => {
  it("throws when repairedQty + damagedQty = 0", async () => {
    const { repairPallets } = await import("@/lib/services/warehouse");
    await expect(
      repairPallets(PM_USER, { palletTypeId: "pt1", repairedQty: 0, damagedQty: 0 }),
    ).rejects.toThrow("ต้องระบุจำนวนซ่อมได้หรือซ่อมไม่ได้อย่างน้อย 1");
  });

  it("throws when quantities are negative", async () => {
    const { repairPallets } = await import("@/lib/services/warehouse");
    await expect(
      repairPallets(PM_USER, { palletTypeId: "pt1", repairedQty: -1, damagedQty: 5 }),
    ).rejects.toThrow("จำนวนต้อง ≥ 0");
  });

  it("throws when total exceeds available PENDING_REPAIR balance (AC-9)", async () => {
    mockPrisma.department.findFirst.mockResolvedValue({ id: "wh", isWarehouse: true, active: true });
    mockPrisma.$queryRaw.mockResolvedValue([{ seq: 1 }]);

    // $executeRaw returns 0 rows → moveStock throws insufficient balance
    const txMock = makeTxMock(0);
    txMock.warehouseStock.findUnique.mockResolvedValue({ quantity: 5 });
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(txMock));

    const { repairPallets } = await import("@/lib/services/warehouse");
    await expect(
      repairPallets(PM_USER, { palletTypeId: "pt1", repairedQty: 8, damagedQty: 5 }),
    ).rejects.toThrow("PENDING_REPAIR");
  });
});

describe("repairPallets split logic", () => {
  it("creates three stock movements when both repaired and damaged quantities > 0", async () => {
    mockPrisma.department.findFirst.mockResolvedValue({ id: "wh", isWarehouse: true, active: true, name: "คลัง" });
    mockPrisma.$queryRaw.mockResolvedValue([{ seq: 1 }]);
    mockPrisma.auditLog.create.mockResolvedValue({});

    const txMock = makeTxMock(1);
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(txMock));

    const { repairPallets } = await import("@/lib/services/warehouse");
    const result = await repairPallets(PM_USER, { palletTypeId: "pt1", repairedQty: 7, damagedQty: 3 });

    expect(result.repairedQty).toBe(7);
    expect(result.damagedQty).toBe(3);
    expect(result.total).toBe(10);
    // 1 PENDING_REPAIR outflow + 1 GOOD inflow + 1 DAMAGED inflow = 3 ledger entries
    expect(txMock.stockMovement.create).toHaveBeenCalledTimes(3);
  });
});
