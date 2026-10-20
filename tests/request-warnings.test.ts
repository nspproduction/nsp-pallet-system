import { describe, it, expect, vi, beforeEach } from "vitest";

// ──────────────────────────────────────────────────────────────────────────────
// Unit tests for BR-2 warning helper
// AC-1: ISSUE submit warns when GOOD balance insufficient
// ──────────────────────────────────────────────────────────────────────────────

import { getRequestWarnings } from "@/lib/services/request";
import { prisma } from "@/lib/prisma";

const mockPrisma = prisma as unknown as {
  request: { findUnique: ReturnType<typeof vi.fn> };
  warehouseStock: { findUnique: ReturnType<typeof vi.fn> };
};

beforeEach(() => vi.clearAllMocks());

// ─── getRequestWarnings — ISSUE (AC-1 / BR-2) ───────────────────────────────

describe("getRequestWarnings — ISSUE type (AC-1 / BR-2)", () => {
  it("warns when warehouse GOOD stock is less than the requested quantity", async () => {
    mockPrisma.request.findUnique.mockResolvedValue({
      id: "req-1",
      type: "ISSUE",
      condition: "GOOD",
      fromDepartmentId: "dept-wh",
      items: [{ palletTypeId: "pt-a", quantity: 12 }],
    });
    mockPrisma.warehouseStock.findUnique.mockResolvedValue({ quantity: 10 });

    const warnings = await getRequestWarnings("req-1");

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("GOOD");
    expect(warnings[0]).toContain("12");  // requested
    expect(warnings[0]).toContain("10");  // available
  });

  it("returns no warnings when warehouse stock is exactly sufficient", async () => {
    mockPrisma.request.findUnique.mockResolvedValue({
      id: "req-1",
      type: "ISSUE",
      condition: "GOOD",
      fromDepartmentId: "dept-wh",
      items: [{ palletTypeId: "pt-a", quantity: 10 }],
    });
    mockPrisma.warehouseStock.findUnique.mockResolvedValue({ quantity: 10 });

    const warnings = await getRequestWarnings("req-1");
    expect(warnings).toHaveLength(0);
  });

  it("returns no warnings when warehouse stock exceeds request", async () => {
    mockPrisma.request.findUnique.mockResolvedValue({
      id: "req-1",
      type: "ISSUE",
      condition: "GOOD",
      fromDepartmentId: "dept-wh",
      items: [{ palletTypeId: "pt-a", quantity: 5 }],
    });
    mockPrisma.warehouseStock.findUnique.mockResolvedValue({ quantity: 20 });

    const warnings = await getRequestWarnings("req-1");
    expect(warnings).toHaveLength(0);
  });

  it("returns empty array for unknown requestId", async () => {
    mockPrisma.request.findUnique.mockResolvedValue(null);
    const warnings = await getRequestWarnings("nonexistent");
    expect(warnings).toHaveLength(0);
  });
});
