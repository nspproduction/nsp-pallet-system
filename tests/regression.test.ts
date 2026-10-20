import { describe, it, expect, vi, beforeEach } from "vitest";

// ──────────────────────────────────────────────────────────────────────────────
// Regression tests for bugs found during review.
// Each test maps to a specific past bug — do not remove without replacement.
// ──────────────────────────────────────────────────────────────────────────────

import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth/current-user";

const mockPrisma = prisma as unknown as {
  department: { findUnique: ReturnType<typeof vi.fn>; findFirst: ReturnType<typeof vi.fn> };
  request: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  approval: { findFirst: ReturnType<typeof vi.fn> };
  warehouseStock: { findMany: ReturnType<typeof vi.fn>; findUnique: ReturnType<typeof vi.fn> };
  palletType: { findMany: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
  $queryRaw: ReturnType<typeof vi.fn>;
  auditLog: { create: ReturnType<typeof vi.fn> };
};

const ADMIN: SessionUser = {
  id: "admin-1",
  roles: ["ADMIN"],
  fullName: "Admin",
  status: "ACTIVE",
} as unknown as SessionUser;

const REQUESTER: SessionUser = {
  id: "u-req",
  roles: ["REQUESTER"],
  fullName: "Requester",
  status: "ACTIVE",
} as unknown as SessionUser;

beforeEach(() => vi.clearAllMocks());

// ──────────────────────────────────────────────────────────────────────────────
// REGRESSION #1 — adjustStock must create WarehouseOperation(type=ADJUSTMENT)
// Bug: dashboard "ปรับยอด" column was blank because adjustments had no linked
// WarehouseOperation, so getWarehouseMovements couldn't categorize them.
// ──────────────────────────────────────────────────────────────────────────────

describe("REG-1: adjustStock creates WarehouseOperation with type=ADJUSTMENT", () => {
  it("creates a warehouseOperation record and links the stockMovement to it", async () => {
    mockPrisma.department.findFirst.mockResolvedValue({ id: "wh", isWarehouse: true, active: true });
    mockPrisma.$queryRaw.mockResolvedValue([{ seq: 1 }]);
    mockPrisma.auditLog.create.mockResolvedValue({});

    const txMock = {
      warehouseOperation: { create: vi.fn().mockResolvedValue({}) },
      stockMovement: { create: vi.fn().mockResolvedValue({}) },
      $executeRaw: vi.fn().mockResolvedValue(1),
      warehouseStock: { findUnique: vi.fn().mockResolvedValue({ quantity: 100 }) },
    };
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(txMock));

    const { adjustStock } = await import("@/lib/services/request");
    await adjustStock(ADMIN, {
      palletTypeId: "pt1",
      condition: "GOOD",
      toDepartmentId: "wh",
      quantity: 10,
      reason: "เพิ่มสต็อกเริ่มต้น",
    });

    // Must create warehouseOperation first
    expect(txMock.warehouseOperation.create).toHaveBeenCalledTimes(1);
    const opArgs = txMock.warehouseOperation.create.mock.calls[0][0];
    expect(opArgs.data.type).toBe("ADJUSTMENT");

    // stockMovement must carry the warehouseOpId (same as operation id)
    expect(txMock.stockMovement.create).toHaveBeenCalledTimes(1);
    const smArgs = txMock.stockMovement.create.mock.calls[0][0];
    expect(smArgs.data.warehouseOpId).toBe(opArgs.data.id);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// REGRESSION #2 — cancelRequest works for PENDING_WAREHOUSE as well as PENDING_DEPT
// Bug: UI hid cancel button for PENDING_WAREHOUSE even though server allows it.
// This test locks the server behavior so UI can rely on it.
// ──────────────────────────────────────────────────────────────────────────────

describe("REG-2: cancelRequest status gating", () => {
  async function expectCancelOk(status: string) {
    mockPrisma.request.findUnique.mockResolvedValue({
      id: "r1",
      status,
      requesterId: "u-req",
      note: null,
    });
    mockPrisma.approval.findFirst.mockResolvedValue(null); // no approvals yet
    mockPrisma.request.update.mockResolvedValue({ id: "r1", status: "CANCELLED" });
    mockPrisma.auditLog.create.mockResolvedValue({});

    const { cancelRequest } = await import("@/lib/services/request");
    const result = await cancelRequest(REQUESTER, "r1", "reason");
    expect(result.status).toBe("CANCELLED");
  }

  async function expectCancelRejected(status: string) {
    mockPrisma.request.findUnique.mockResolvedValue({
      id: "r1",
      status,
      requesterId: "u-req",
      note: null,
    });
    const { cancelRequest } = await import("@/lib/services/request");
    await expect(cancelRequest(REQUESTER, "r1", "reason")).rejects.toThrow();
  }

  it("allows cancel for PENDING_DEPT", () => expectCancelOk("PENDING_DEPT"));
  it("allows cancel for PENDING_WAREHOUSE", () => expectCancelOk("PENDING_WAREHOUSE"));
  it("rejects cancel for COMPLETED", () => expectCancelRejected("COMPLETED"));
  it("rejects cancel for REJECTED", () => expectCancelRejected("REJECTED"));
  it("rejects cancel for CANCELLED", () => expectCancelRejected("CANCELLED"));
});

// ──────────────────────────────────────────────────────────────────────────────
// REGRESSION #3 — getWarehouseConditionSummary includes inactive palletTypes
// with remaining stock, so PM can clear leftover PENDING_REPAIR / DAMAGED stock
// after deactivating a palletType.
// Bug: previously filtered `palletType: { active: true }`, hiding leftover stock.
// ──────────────────────────────────────────────────────────────────────────────

describe("REG-3: getWarehouseConditionSummary includes inactive palletTypes with stock", () => {
  it("returns inactive palletType row when it still has stock", async () => {
    mockPrisma.warehouseStock.findMany.mockResolvedValue([
      {
        palletTypeId: "pt-inactive",
        condition: "DAMAGED",
        quantity: 5,
        palletType: { id: "pt-inactive", name: "ชนิดเก่า", active: false },
      },
      {
        palletTypeId: "pt-active",
        condition: "GOOD",
        quantity: 100,
        palletType: { id: "pt-active", name: "ชนิดใหม่", active: true },
      },
    ]);
    mockPrisma.palletType.findMany.mockResolvedValue([
      { id: "pt-active", name: "ชนิดใหม่", active: true },
    ]);

    const { getWarehouseConditionSummary } = await import("@/lib/services/warehouse");
    const result = await getWarehouseConditionSummary();

    const inactive = result.find((r) => r.id === "pt-inactive");
    expect(inactive).toBeDefined();
    expect(inactive?.active).toBe(false);
    expect(inactive?.unusable).toBe(5);
  });

  it("excludes inactive palletType when it has zero stock", async () => {
    mockPrisma.warehouseStock.findMany.mockResolvedValue([]);
    mockPrisma.palletType.findMany.mockResolvedValue([
      { id: "pt-active", name: "ยังใช้", active: true },
    ]);

    const { getWarehouseConditionSummary } = await import("@/lib/services/warehouse");
    const result = await getWarehouseConditionSummary();

    // Only the active one (zero stock) — inactive has no row at all
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("pt-active");
  });
});

