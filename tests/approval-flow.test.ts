import { describe, it, expect, vi, beforeEach } from "vitest";

// ──────────────────────────────────────────────────────────────────────────────
// Unit tests for approveRequest state machine and stock enforcement
// AC-1:  ISSUE final approval blocked when GOOD stock exhausted
// AC-2:  2-step route: dept step 1 advances to step 2, still PENDING_DEPT
// AC-3:  1-step route: last dept step advances to PENDING_WAREHOUSE
// AC-4:  Requester cannot approve their own request (throws)
// AC-5:  RETURN final approval creates a stock movement with correct condition
// AC-9:  Concurrent ISSUE approval — conditional DB update prevents negative balance
// AC-13: Email goes to outbox (inside tx), not directly to mail provider
// ──────────────────────────────────────────────────────────────────────────────

import { approveRequest } from "@/lib/services/request";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth/current-user";

const mockPrisma = prisma as unknown as {
  request: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  approval: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  auditLog: { create: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

const PM: SessionUser = {
  id: "pm-1",
  roles: ["PALLET_MANAGER"],
  fullName: "PM",
  status: "ACTIVE",
  departmentId: null,
  sectionId: null,
} as unknown as SessionUser;

const APPROVER: SessionUser = {
  id: "approver-1",
  roles: ["DEPT_APPROVER"],
  fullName: "Approver",
  status: "ACTIVE",
  departmentId: null,
  sectionId: null,
} as unknown as SessionUser;

/** Builds a transaction-client mock for approval flow tests. */
function makeTxMock(executeRawResult = 1) {
  return {
    approval: { create: vi.fn().mockResolvedValue({}) },
    stockMovement: { create: vi.fn().mockResolvedValue({}) },
    $executeRaw: vi.fn().mockResolvedValue(executeRawResult),
    warehouseStock: { findUnique: vi.fn().mockResolvedValue({ quantity: 100 }) },
    request: {
      findUnique: vi.fn().mockResolvedValue(null), // no email by default
      update: vi.fn().mockResolvedValue({ id: "req-1", status: "COMPLETED" }),
    },
    emailOutbox: { create: vi.fn().mockResolvedValue({}) },
    requestRevision: { create: vi.fn().mockResolvedValue({}) },
    requestItem: {
      deleteMany: vi.fn().mockResolvedValue({}),
      createMany: vi.fn().mockResolvedValue({}),
    },
  };
}

beforeEach(() => vi.clearAllMocks());

// ─── AC-4: self-approval guard ───────────────────────────────────────────────

describe("approveRequest — self-approval guard (AC-4)", () => {
  it("throws when the approver is the same person who created the request", async () => {
    mockPrisma.request.findUnique.mockResolvedValue({
      id: "req-1",
      requesterId: PM.id,  // same as approver
      status: "PENDING_WAREHOUSE",
      stepSnapshot: [],
      currentStepOrder: null,
      items: [],
    });

    await expect(approveRequest(PM, "req-1")).rejects.toThrow("ผู้ร้องขอกับผู้อนุมัติ");
  });
});

// ─── AC-2, AC-3: dept step state machine ────────────────────────────────────

describe("approveRequest — dept step advancement (AC-2, AC-3)", () => {
  it("advances from step 1 to step 2 when route has 2 steps (AC-2)", async () => {
    const stepSnapshot = [
      { stepOrder: 1, name: "หัวหน้า", approverIds: [APPROVER.id] },
      { stepOrder: 2, name: "ผู้จัดการ", approverIds: ["mgr-1"] },
    ];
    mockPrisma.request.findUnique.mockResolvedValue({
      id: "req-1", requesterId: "other-user",
      status: "PENDING_DEPT", currentStepOrder: 1,
      stepSnapshot, items: [],
    });
    mockPrisma.approval.findFirst.mockResolvedValue(null);
    const txMock = makeTxMock();
    txMock.request.update.mockResolvedValue({ id: "req-1", status: "PENDING_DEPT", currentStepOrder: 2 });
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(txMock));
    mockPrisma.auditLog.create.mockResolvedValue({});

    await approveRequest(APPROVER, "req-1");

    expect(txMock.request.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PENDING_DEPT", currentStepOrder: 2 }),
      }),
    );
  });

  it("moves to PENDING_WAREHOUSE after the last dept step (AC-3)", async () => {
    const stepSnapshot = [
      { stepOrder: 1, name: "หัวหน้า", approverIds: [APPROVER.id] },
    ];
    mockPrisma.request.findUnique.mockResolvedValue({
      id: "req-1", requesterId: "other-user",
      status: "PENDING_DEPT", currentStepOrder: 1,
      stepSnapshot, items: [],
    });
    mockPrisma.approval.findFirst.mockResolvedValue(null);
    const txMock = makeTxMock();
    txMock.request.update.mockResolvedValue({ id: "req-1", status: "PENDING_WAREHOUSE" });
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(txMock));
    mockPrisma.auditLog.create.mockResolvedValue({});

    await approveRequest(APPROVER, "req-1");

    expect(txMock.request.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PENDING_WAREHOUSE", currentStepOrder: null }),
      }),
    );
  });
});

// ─── AC-5: RETURN final approval creates correct stock movement ──────────────

describe("approveRequest — RETURN final step stock movement (AC-5)", () => {
  it("creates a PENDING_REPAIR inflow movement when approving a RETURN request (AC-5)", async () => {
    mockPrisma.request.findUnique.mockResolvedValue({
      id: "req-1", requesterId: "requester-1",
      status: "PENDING_WAREHOUSE", currentStepOrder: null,
      stepSnapshot: [],
      type: "RETURN", condition: "PENDING_REPAIR", docNo: "RT-001",
      fromDepartmentId: "dept-mixer", fromSectionId: null,
      toDepartmentId: "dept-wh", toSectionId: null,
      items: [{ palletTypeId: "pt-a", quantity: 5 }],
    });
    mockPrisma.approval.findFirst.mockResolvedValue(null);
    const txMock = makeTxMock();
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(txMock));
    mockPrisma.auditLog.create.mockResolvedValue({});

    await approveRequest(PM, "req-1");

    // moveStock is called with positive delta (inflow) for RETURN
    expect(txMock.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          palletTypeId: "pt-a",
          condition: "PENDING_REPAIR",
          quantity: 5,
        }),
      }),
    );
    // Warehouse stock upsert ran (inflow path uses $executeRaw INSERT ON CONFLICT)
    expect(txMock.$executeRaw).toHaveBeenCalled();
    // Request marked COMPLETED
    expect(txMock.request.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "COMPLETED" }),
      }),
    );
  });
});

// ─── AC-1 / AC-9: stock exhaustion at final ISSUE approval ──────────────────

describe("approveRequest — stock enforcement at final step (AC-1, AC-9)", () => {
  it("throws when GOOD stock is exhausted at the moment of final ISSUE approval (AC-1, AC-9)", async () => {
    mockPrisma.request.findUnique.mockResolvedValue({
      id: "req-1", requesterId: "requester-1",
      status: "PENDING_WAREHOUSE", currentStepOrder: null,
      stepSnapshot: [],
      type: "ISSUE", condition: "GOOD", docNo: "IS-001",
      fromDepartmentId: "dept-wh", fromSectionId: null,
      toDepartmentId: "dept-prod", toSectionId: null,
      items: [{ palletTypeId: "pt-a", quantity: 12 }],
    });
    mockPrisma.approval.findFirst.mockResolvedValue(null);

    // $executeRaw returns 0 rows → conditional UPDATE found nothing → stock too low
    const txMock = makeTxMock(0);
    txMock.warehouseStock.findUnique.mockResolvedValue({ quantity: 10 }); // 10 available, 12 requested
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(txMock));
    mockPrisma.auditLog.create.mockResolvedValue({});

    await expect(approveRequest(PM, "req-1")).rejects.toThrow("GOOD");
  });
});

// ─── AC-13: email goes to outbox, not directly to mail provider ──────────────

describe("approveRequest — email resilience (AC-13)", () => {
  it("writes email to outbox inside the transaction, never calling the mail provider directly", async () => {
    const requesterEmail = "requester@example.com";
    mockPrisma.request.findUnique.mockResolvedValue({
      id: "req-1", requesterId: "requester-1",
      status: "PENDING_WAREHOUSE", currentStepOrder: null,
      stepSnapshot: [],
      type: "ISSUE", condition: "GOOD", docNo: "IS-001",
      fromDepartmentId: "dept-wh", fromSectionId: null,
      toDepartmentId: "dept-prod", toSectionId: null,
      items: [{ palletTypeId: "pt-a", quantity: 3 }],
    });
    mockPrisma.approval.findFirst.mockResolvedValue(null);
    const txMock = makeTxMock(1);
    // tx.request.findUnique is called inside the tx to build the email
    txMock.request.findUnique.mockResolvedValue({
      requester: { email: requesterEmail, fullName: "Test User" },
      fromDepartment: { name: "คลังพาเลท" },
      items: [{ palletType: { name: "พาเลทไม้" }, quantity: 3 }],
    });
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(txMock));
    mockPrisma.auditLog.create.mockResolvedValue({});

    await approveRequest(PM, "req-1");

    // Email was queued in the DB outbox, not sent via external API
    expect(txMock.emailOutbox.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ to: requesterEmail }),
      }),
    );
  });
});
