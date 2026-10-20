import { describe, it, expect, vi, beforeEach } from "vitest";

// ──────────────────────────────────────────────────────────────────────────────
// AC-7:  editAndApprove — revision record created + stock moves with revised qty
// AC-11: PENDING user is not authenticated (getCurrentUser returns null)
// AC-12: Stored stepSnapshot is independent of live route changes (immutable)
// ──────────────────────────────────────────────────────────────────────────────

// ---- mock session so getCurrentUser can be tested without HTTP cookies ----
vi.mock("@/lib/auth/session", () => ({
  readSession: vi.fn(),
}));

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
  user: { findUnique: ReturnType<typeof vi.fn> };
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

function makeTxMock(executeRawResult = 1) {
  return {
    requestItem: { deleteMany: vi.fn().mockResolvedValue({}), createMany: vi.fn().mockResolvedValue({}) },
    requestRevision: { create: vi.fn().mockResolvedValue({}) },
    stockMovement: { create: vi.fn().mockResolvedValue({}) },
    $executeRaw: vi.fn().mockResolvedValue(executeRawResult),
    warehouseStock: { findUnique: vi.fn().mockResolvedValue({ quantity: 100 }) },
    approval: { create: vi.fn().mockResolvedValue({}) },
    request: {
      findUnique: vi.fn().mockResolvedValue(null), // no email by default
      update: vi.fn().mockResolvedValue({ id: "req-1", status: "COMPLETED" }),
    },
    emailOutbox: { create: vi.fn().mockResolvedValue({}) },
  };
}

beforeEach(() => vi.clearAllMocks());

// ─── AC-7: editAndApprove ────────────────────────────────────────────────────

describe("editAndApprove — revision + revised stock movement (AC-7)", () => {
  it("creates a revision record with before/after and moves stock using the revised quantity", async () => {
    const { editAndApprove } = await import("@/lib/services/request");

    mockPrisma.request.findUnique.mockResolvedValue({
      id: "req-1",
      requesterId: "requester-1",
      status: "PENDING_WAREHOUSE",
      stepSnapshot: [],
      type: "RETURN",
      condition: "GOOD",
      docNo: "RT-001",
      fromDepartmentId: "dept-prod",
      fromSectionId: null,
      toDepartmentId: "dept-wh",
      toSectionId: null,
      items: [{ palletTypeId: "pt-a", quantity: 10 }], // original qty = 10
    });

    const txMock = makeTxMock(1);
    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => fn(txMock),
    );
    mockPrisma.auditLog.create.mockResolvedValue({});

    // PM revises down to 8 with a reason (AC-7 scenario)
    const revisedItems = [{ palletTypeId: "pt-a", condition: "GOOD" as const, quantity: 8 }];
    await editAndApprove(PM, "req-1", revisedItems, "ตรวจนับพาเลทจริงได้ 8 ใบ");

    // ① Revision record must be written
    expect(txMock.requestRevision.create).toHaveBeenCalledTimes(1);
    const revisionCall = txMock.requestRevision.create.mock.calls[0][0];
    expect(revisionCall.data.reason).toBe("ตรวจนับพาเลทจริงได้ 8 ใบ");
    expect(revisionCall.data.before).toMatchObject({ items: expect.any(Array) });
    expect(revisionCall.data.after).toMatchObject({ items: revisedItems });

    // ② Stock movement uses the revised quantity (8), not the original (10)
    expect(txMock.stockMovement.create).toHaveBeenCalledTimes(1);
    const movementCall = txMock.stockMovement.create.mock.calls[0][0];
    expect(movementCall.data.quantity).toBe(8);
    expect(movementCall.data.palletTypeId).toBe("pt-a");

    // ③ Request marked COMPLETED
    expect(txMock.request.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "COMPLETED" }),
      }),
    );
  });

  it("throws when the approver is the requester (AC-4 still holds for editAndApprove)", async () => {
    const { editAndApprove } = await import("@/lib/services/request");
    // PM who also happens to be the requester of this request
    const REQUESTER_PM = { ...PM, id: "requester-1" } as unknown as SessionUser;

    mockPrisma.request.findUnique.mockResolvedValue({
      id: "req-1",
      requesterId: "requester-1", // ← same as REQUESTER_PM.id
      status: "PENDING_WAREHOUSE",
      stepSnapshot: [],
      type: "RETURN",
      condition: "GOOD",
      items: [{ palletTypeId: "pt-a", quantity: 10 }],
    });

    await expect(
      editAndApprove(
        REQUESTER_PM,
        "req-1",
        [{ palletTypeId: "pt-a", condition: "GOOD", quantity: 8 }],
        "เหตุผล",
      ),
    ).rejects.toThrow("ผู้ร้องขอกับผู้อนุมัติ");
  });
});

// ─── AC-11: PENDING user cannot authenticate ────────────────────────────────

describe("getCurrentUser / requireUser — PENDING user blocked (AC-11)", () => {
  it("getCurrentUser returns null when user status is PENDING", async () => {
    const { readSession } = await import("@/lib/auth/session");
    const { getCurrentUser } = await import("@/lib/auth/current-user");

    (readSession as ReturnType<typeof vi.fn>).mockResolvedValue({ uid: "user-pending", exp: 9999999999 });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-pending",
      status: "PENDING",
      roles: [],
      fullName: "New User",
    });

    const user = await getCurrentUser();
    expect(user).toBeNull();
  });

  it("getCurrentUser returns null when user status is DISABLED", async () => {
    const { readSession } = await import("@/lib/auth/session");
    const { getCurrentUser } = await import("@/lib/auth/current-user");

    (readSession as ReturnType<typeof vi.fn>).mockResolvedValue({ uid: "user-disabled", exp: 9999999999 });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-disabled",
      status: "DISABLED",
      roles: [],
      fullName: "Disabled User",
    });

    const user = await getCurrentUser();
    expect(user).toBeNull();
  });

  it("getCurrentUser returns the user when status is ACTIVE", async () => {
    const { readSession } = await import("@/lib/auth/session");
    const { getCurrentUser } = await import("@/lib/auth/current-user");

    const activeUser = { id: "user-active", status: "ACTIVE", roles: ["REQUESTER"], fullName: "Active" };
    (readSession as ReturnType<typeof vi.fn>).mockResolvedValue({ uid: "user-active", exp: 9999999999 });
    mockPrisma.user.findUnique.mockResolvedValue(activeUser);

    const user = await getCurrentUser();
    expect(user).not.toBeNull();
    expect(user?.id).toBe("user-active");
  });

  it("getCurrentUser returns null when there is no session", async () => {
    const { readSession } = await import("@/lib/auth/session");
    const { getCurrentUser } = await import("@/lib/auth/current-user");

    (readSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const user = await getCurrentUser();
    expect(user).toBeNull();
  });
});

// ─── AC-12: stepSnapshot immutability ────────────────────────────────────────

describe("approveRequest — stepSnapshot is immutable after submission (AC-12)", () => {
  it("uses the snapshot stored on the request, not the live route configuration", async () => {
    // Scenario: request was submitted when route had 2 steps.
    // Even if the live route is updated to 3 steps, the in-flight request
    // still uses its stored 2-step snapshot.

    const { approveRequest } = await import("@/lib/services/request");

    const APPROVER = {
      id: "approver-1",
      roles: ["DEPT_APPROVER"],
      fullName: "Approver",
      status: "ACTIVE",
      departmentId: null,
      sectionId: null,
    } as unknown as SessionUser;

    // The stored snapshot still has the 2-step configuration from when the request was submitted
    const frozenSnapshot = [
      { stepOrder: 1, name: "หัวหน้า", approverIds: ["approver-1"] },
      { stepOrder: 2, name: "ผู้จัดการ", approverIds: ["mgr-1"] },
    ];

    mockPrisma.request.findUnique.mockResolvedValue({
      id: "req-1",
      requesterId: "other-user",
      status: "PENDING_DEPT",
      currentStepOrder: 1,
      stepSnapshot: frozenSnapshot, // ← 2 steps, frozen at submission
      items: [],
    });
    mockPrisma.approval.findFirst.mockResolvedValue(null);

    const txMock = makeTxMock();
    txMock.request.update.mockResolvedValue({ id: "req-1", status: "PENDING_DEPT", currentStepOrder: 2 });
    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => fn(txMock),
    );
    mockPrisma.auditLog.create.mockResolvedValue({});

    await approveRequest(APPROVER, "req-1");

    // Step advances to 2 based on the frozen snapshot, NOT any live route change
    expect(txMock.request.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PENDING_DEPT", currentStepOrder: 2 }),
      }),
    );
  });
});
