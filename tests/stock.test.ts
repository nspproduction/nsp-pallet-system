import { describe, it, expect, vi, beforeEach } from "vitest";

// ──────────────────────────────────────────────────────────────────────────────
// Unit tests for stock balance calculation (BR-1, BR-2)
// ──────────────────────────────────────────────────────────────────────────────

import { getAvailableBalance } from "@/lib/services/request";
import { prisma } from "@/lib/prisma";

const mockPrisma = prisma as unknown as {
  warehouseStock: { findUnique: ReturnType<typeof vi.fn> };
  requestItem: { aggregate: ReturnType<typeof vi.fn> };
};

const PARAMS = { palletTypeId: "pt-1", condition: "GOOD" as const, departmentId: "dept-wh" };

beforeEach(() => vi.clearAllMocks());

describe("getAvailableBalance (BR-1, BR-2)", () => {
  it("returns positive balance = snapshot − reserved", async () => {
    mockPrisma.warehouseStock.findUnique.mockResolvedValue({ quantity: 70 });
    mockPrisma.requestItem.aggregate.mockResolvedValue({ _sum: { quantity: 10 } });

    const balance = await getAvailableBalance(PARAMS);
    expect(balance).toBe(60); // 70 - 10
  });

  it("returns 0 when snapshot equals reserved", async () => {
    mockPrisma.warehouseStock.findUnique.mockResolvedValue({ quantity: 20 });
    mockPrisma.requestItem.aggregate.mockResolvedValue({ _sum: { quantity: 20 } });

    const balance = await getAvailableBalance(PARAMS);
    expect(balance).toBe(0);
  });

  it("returns negative when reserved exceeds snapshot (should be blocked by approval)", async () => {
    mockPrisma.warehouseStock.findUnique.mockResolvedValue({ quantity: 5 });
    mockPrisma.requestItem.aggregate.mockResolvedValue({ _sum: { quantity: 10 } });

    // Returns -5; caller (createRequest) throws HttpError 400
    const balance = await getAvailableBalance(PARAMS);
    expect(balance).toBe(-5);
  });

  it("handles missing snapshot (no stock row yet) and null aggregate as zero", async () => {
    mockPrisma.warehouseStock.findUnique.mockResolvedValue(null);
    mockPrisma.requestItem.aggregate.mockResolvedValue({ _sum: { quantity: null } });

    const balance = await getAvailableBalance(PARAMS);
    expect(balance).toBe(0);
  });

  it("accounts for reserved in-flight requests to prevent double-allocation (BR-2)", async () => {
    // Physical snapshot: 50 pallets in warehouse
    // Reserved: 40 in-flight ISSUE requests
    mockPrisma.warehouseStock.findUnique.mockResolvedValue({ quantity: 50 });
    mockPrisma.requestItem.aggregate.mockResolvedValue({ _sum: { quantity: 40 } });

    const balance = await getAvailableBalance(PARAMS);
    expect(balance).toBe(10); // only 10 truly available
  });
});
