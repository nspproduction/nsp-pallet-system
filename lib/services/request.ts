import { Prisma } from "@prisma/client";
import type { PalletCondition, RequestType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/auth/current-user";
import { nextDocNo } from "@/lib/services/docno";
import { writeAudit } from "@/lib/services/audit";
import type { SessionUser } from "@/lib/auth/current-user";

// Pallet warehouse is identified by the department with this code.
const WAREHOUSE_DEPT_CODE = "WH-PL";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface CreateRequestInput {
  type: RequestType;
  // Dept/section-based routing. "คลังพาเลท" = department code "WH-PL".
  // UI typically passes nothing here — the service auto-fills based on type +
  // the requester's department. These fields are kept to allow admin override.
  fromDepartmentId?: string | null;
  fromSectionId?: string | null;
  toDepartmentId?: string | null;
  toSectionId?: string | null;
  // Snapshot of requester's current section at creation time (may differ from
  // their current section if they move later).
  sectionId?: string | null;
  neededDate?: Date | null;
  purpose?: string | null;
  note?: string | null;
  items: {
    palletTypeId: string;
    condition: PalletCondition;
    quantity: number;
    note?: string | null;
  }[];
}

// -----------------------------------------------------------------------------
// Rules
// -----------------------------------------------------------------------------

// Types that decrease stock at fromDepartment (must reserve balance).
// Phase 1 only tracks warehouse balance, so only outflows FROM warehouse count.
const CONSUMES_FROM = new Set<RequestType>(["ISSUE_INTERNAL", "WRITE_OFF"]);

// Return-flow types: all items in one request must share the same condition.
const RETURN_TYPES = new Set<RequestType>(["RETURN_INTERNAL"]);

async function getWarehouseDept() {
  const dept = await prisma.department.findUnique({
    where: { code: WAREHOUSE_DEPT_CODE },
    select: { id: true, code: true, name: true, active: true },
  });
  if (!dept || !dept.active) {
    throw new HttpError(500, `ยังไม่ได้ตั้งค่าแผนกคลังพาเลท (department code = ${WAREHOUSE_DEPT_CODE})`);
  }
  return dept;
}

// -----------------------------------------------------------------------------
// Available balance at the warehouse (physical − reserved by pending/approved outflows)
// -----------------------------------------------------------------------------

export async function getAvailableBalance(params: {
  palletTypeId: string;
  condition: PalletCondition;
  departmentId: string;
}): Promise<number> {
  const [inSum, outSum, reserved] = await Promise.all([
    prisma.stockMovement.aggregate({
      _sum: { quantity: true },
      where: {
        palletTypeId: params.palletTypeId,
        condition: params.condition,
        toDepartmentId: params.departmentId,
      },
    }),
    prisma.stockMovement.aggregate({
      _sum: { quantity: true },
      where: {
        palletTypeId: params.palletTypeId,
        condition: params.condition,
        fromDepartmentId: params.departmentId,
      },
    }),
    prisma.requestItem.aggregate({
      _sum: { quantity: true },
      where: {
        palletTypeId: params.palletTypeId,
        condition: params.condition,
        request: {
          fromDepartmentId: params.departmentId,
          status: "PENDING",
          type: { in: [...CONSUMES_FROM] },
        },
      },
    }),
  ]);
  const physical = (inSum._sum.quantity ?? 0) - (outSum._sum.quantity ?? 0);
  const soft = reserved._sum.quantity ?? 0;
  return physical - soft;
}

// -----------------------------------------------------------------------------
// Create → PENDING
// -----------------------------------------------------------------------------

export async function createRequest(user: SessionUser, input: CreateRequestInput) {
  if (!["REQUESTER", "ADMIN"].includes(user.role)) {
    throw new HttpError(403, "บทบาทของคุณไม่สามารถสร้างคำขอได้");
  }
  if (!input.items?.length) throw new HttpError(400, "ต้องมี item อย่างน้อย 1 รายการ");
  for (const it of input.items) {
    if (it.quantity <= 0) throw new HttpError(400, "quantity ต้อง > 0");
  }

  const warehouse = await getWarehouseDept();

  // Department-scoped type restrictions
  if (input.type === "RECEIVE_NEW") {
    const dept = user.departmentId
      ? await prisma.department.findUnique({
          where: { id: user.departmentId },
          select: { code: true },
        })
      : null;
    if (dept?.code !== "WH") {
      throw new HttpError(403, "เฉพาะแผนกพัสดุ (WH) เท่านั้นที่สร้างคำขอรับเข้าใหม่ได้");
    }
    if (input.items.some((it) => it.condition !== "USABLE")) {
      throw new HttpError(400, "รับเข้าใหม่ต้องเป็นสภาพ USABLE เท่านั้น");
    }
  }

  // Return-flows: single condition per request
  if (RETURN_TYPES.has(input.type)) {
    const conditions = new Set(input.items.map((it) => it.condition));
    if (conditions.size > 1) {
      throw new HttpError(
        400,
        "คำขอคืนเข้า 1 ใบต้องเป็นสภาพเดียวกันทุกบรรทัด (หากมีหลายสภาพ กรุณาสร้างคำขอแยก)",
      );
    }
  }

  // Snapshot requester's section if not explicitly provided
  if (input.sectionId === undefined) {
    input.sectionId = user.sectionId ?? null;
  } else if (input.sectionId) {
    const section = await prisma.departmentSection.findUnique({
      where: { id: input.sectionId },
    });
    if (!section) throw new HttpError(400, "ไม่พบ section");
    if (section.departmentId !== user.departmentId) {
      throw new HttpError(400, "section ไม่อยู่ในแผนกของผู้ร้องขอ");
    }
  }

  // Auto-fill from/to departments based on type (overridable via input)
  let fromDepartmentId = input.fromDepartmentId ?? null;
  let fromSectionId = input.fromSectionId ?? null;
  let toDepartmentId = input.toDepartmentId ?? null;
  let toSectionId = input.toSectionId ?? null;

  switch (input.type) {
    case "RECEIVE_NEW":
      // Supplier side not tracked. New pallets land in the warehouse.
      fromDepartmentId = null;
      fromSectionId = null;
      toDepartmentId = warehouse.id;
      toSectionId = null;
      break;
    case "ISSUE_INTERNAL":
      // Warehouse → requester's department (+ their current section)
      fromDepartmentId = warehouse.id;
      fromSectionId = null;
      toDepartmentId = user.departmentId ?? null;
      toSectionId = input.sectionId ?? null;
      break;
    case "RETURN_INTERNAL":
      // Requester's department → warehouse
      fromDepartmentId = user.departmentId ?? null;
      fromSectionId = input.sectionId ?? null;
      toDepartmentId = warehouse.id;
      toSectionId = null;
      break;
    case "WRITE_OFF":
      // Admin writes off from the warehouse
      fromDepartmentId = fromDepartmentId ?? warehouse.id;
      toDepartmentId = null;
      break;
    case "ADJUSTMENT":
      // Admin-defined; both sides optional
      break;
    default:
      // Legacy enum values retained in DB but not routed by phase-1 UI
      break;
  }

  if (input.type === "ISSUE_INTERNAL" && !toDepartmentId) {
    throw new HttpError(400, "ผู้ร้องขอยังไม่ได้ผูกกับแผนก");
  }
  if (input.type === "RETURN_INTERNAL" && !fromDepartmentId) {
    throw new HttpError(400, "ผู้ร้องขอยังไม่ได้ผูกกับแผนก");
  }

  // Soft-reserve check for outflows FROM the warehouse
  if (CONSUMES_FROM.has(input.type) && fromDepartmentId) {
    const agg = new Map<string, number>();
    for (const it of input.items) {
      const k = `${it.palletTypeId}::${it.condition}`;
      agg.set(k, (agg.get(k) ?? 0) + it.quantity);
    }
    for (const [k, qty] of agg.entries()) {
      const [palletTypeId, condition] = k.split("::");
      const avail = await getAvailableBalance({
        palletTypeId,
        condition: condition as PalletCondition,
        departmentId: fromDepartmentId,
      });
      if (avail < qty) {
        throw new HttpError(
          400,
          `ยอดคงเหลือไม่พอสำหรับ ${palletTypeId} (${condition}): ต้องการ ${qty}, มี ${avail}`,
        );
      }
    }
  }

  const docNo = await nextDocNo(input.type);

  const created = await prisma.request.create({
    data: {
      docNo,
      type: input.type,
      status: "PENDING",
      requesterId: user.id,
      fromDepartmentId,
      fromSectionId,
      toDepartmentId,
      toSectionId,
      sectionId: input.sectionId ?? null,
      neededDate: input.neededDate ?? null,
      purpose: input.purpose ?? null,
      note: input.note ?? null,
      submittedAt: new Date(),
      items: {
        create: input.items.map((it) => ({
          palletTypeId: it.palletTypeId,
          condition: it.condition,
          quantity: it.quantity,
          note: it.note ?? null,
        })),
      },
    },
    include: { items: true },
  });

  await writeAudit({
    userId: user.id,
    entity: "request",
    entityId: created.id,
    action: "create",
    after: created,
  });

  return created;
}

// -----------------------------------------------------------------------------
// Cancel (requester only, only if PENDING)
// -----------------------------------------------------------------------------

export async function cancelRequest(user: SessionUser, requestId: string, reason?: string) {
  const r = await prisma.request.findUnique({ where: { id: requestId } });
  if (!r) throw new HttpError(404, "request ไม่พบ");
  if (r.requesterId !== user.id && user.role !== "ADMIN") {
    throw new HttpError(403, "ไม่มีสิทธิ์ยกเลิกคำขอนี้");
  }
  if (r.status !== "PENDING") {
    throw new HttpError(400, "ยกเลิกได้เฉพาะคำขอที่ยังไม่ได้อนุมัติ");
  }

  const updated = await prisma.request.update({
    where: { id: requestId },
    data: { status: "CANCELLED", cancelledAt: new Date(), note: reason ?? r.note },
  });
  await writeAudit({
    userId: user.id,
    entity: "request",
    entityId: requestId,
    action: "cancel",
    after: { status: updated.status, reason },
  });
  return updated;
}

// -----------------------------------------------------------------------------
// Approve / Reject
// -----------------------------------------------------------------------------

export async function approveRequest(user: SessionUser, requestId: string, comment?: string) {
  if (!["APPROVER", "ADMIN"].includes(user.role)) throw new HttpError(403, "ต้องมีสิทธิ์ผู้อนุมัติ");
  const r = await prisma.request.findUnique({
    where: { id: requestId },
    include: { items: true },
  });
  if (!r) throw new HttpError(404, "request ไม่พบ");
  if (r.status !== "PENDING") throw new HttpError(400, "อนุมัติได้เฉพาะคำขอสถานะ PENDING");
  if (r.requesterId === user.id) throw new HttpError(400, "ผู้ร้องขอกับผู้อนุมัติต้องไม่ใช่คนเดียวกัน");

  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    await tx.approval.create({
      data: {
        requestId,
        approverId: user.id,
        decision: "APPROVED",
        comment: comment ?? null,
      },
    });

    for (const it of r.items) {
      await tx.stockMovement.create({
        data: {
          requestId: r.id,
          palletTypeId: it.palletTypeId,
          condition: it.condition,
          quantity: it.quantity,
          fromDepartmentId: r.fromDepartmentId ?? null,
          fromSectionId: r.fromSectionId ?? null,
          toDepartmentId: r.toDepartmentId ?? null,
          toSectionId: r.toSectionId ?? null,
          occurredAt: now,
          reason: `Request ${r.docNo}`,
        },
      });
    }

    return tx.request.update({
      where: { id: requestId },
      data: { status: "APPROVED", approvedAt: now },
    });
  });

  await writeAudit({
    userId: user.id,
    entity: "request",
    entityId: requestId,
    action: "approve",
    after: { comment },
  });
  return updated;
}

export async function rejectRequest(user: SessionUser, requestId: string, comment: string) {
  if (!["APPROVER", "ADMIN"].includes(user.role)) throw new HttpError(403, "ต้องมีสิทธิ์ผู้อนุมัติ");
  if (!comment?.trim()) throw new HttpError(400, "ต้องระบุเหตุผลการปฏิเสธ");
  const r = await prisma.request.findUnique({ where: { id: requestId } });
  if (!r) throw new HttpError(404, "request ไม่พบ");
  if (r.status !== "PENDING") throw new HttpError(400, "ปฏิเสธได้เฉพาะคำขอสถานะ PENDING");
  if (r.requesterId === user.id) throw new HttpError(400, "ผู้ร้องขอกับผู้อนุมัติต้องไม่ใช่คนเดียวกัน");

  const [updated] = await prisma.$transaction([
    prisma.request.update({
      where: { id: requestId },
      data: { status: "REJECTED" },
    }),
    prisma.approval.create({
      data: {
        requestId,
        approverId: user.id,
        decision: "REJECTED",
        comment,
      },
    }),
  ]);
  await writeAudit({
    userId: user.id,
    entity: "request",
    entityId: requestId,
    action: "reject",
    after: { comment },
  });
  return updated;
}

// -----------------------------------------------------------------------------
// Admin adjustment (bypass workflow) — one-shot stock movement
// -----------------------------------------------------------------------------

export async function adjustStock(
  user: SessionUser,
  input: {
    palletTypeId: string;
    condition: PalletCondition;
    fromDepartmentId?: string | null;
    toDepartmentId?: string | null;
    quantity: number;
    reason: string;
  },
) {
  if (user.role !== "ADMIN") throw new HttpError(403, "เฉพาะ Admin เท่านั้น");
  if (input.quantity <= 0) throw new HttpError(400, "quantity ต้อง > 0");
  if (!input.reason?.trim()) throw new HttpError(400, "ต้องระบุเหตุผลการปรับยอด");
  if (!input.fromDepartmentId && !input.toDepartmentId) {
    throw new HttpError(400, "ต้องระบุ fromDepartment หรือ toDepartment อย่างน้อย 1 อย่าง");
  }

  const movement = await prisma.stockMovement.create({
    data: {
      palletTypeId: input.palletTypeId,
      condition: input.condition,
      quantity: input.quantity,
      fromDepartmentId: input.fromDepartmentId ?? null,
      toDepartmentId: input.toDepartmentId ?? null,
      reason: `[ADJUST] ${input.reason}`,
      occurredAt: new Date(),
    },
  });

  await writeAudit({
    userId: user.id,
    entity: "stock_movement",
    entityId: movement.id,
    action: "adjust",
    after: movement,
  });

  return movement;
}

// -----------------------------------------------------------------------------
// Queries
// -----------------------------------------------------------------------------

export type RequestListFilter = {
  status?: Prisma.RequestWhereInput["status"];
  type?: Prisma.RequestWhereInput["type"];
  requesterId?: string;
  awaitingApprovalFor?: string; // user id — PENDING and not created by that user
  decidedBy?: string;           // user id — requests with any approval by that user
  limit?: number;
  offset?: number;
};

export async function listRequests(f: RequestListFilter = {}) {
  const where: Prisma.RequestWhereInput = {};
  if (f.status) where.status = f.status;
  if (f.type) where.type = f.type;
  if (f.requesterId) where.requesterId = f.requesterId;
  if (f.awaitingApprovalFor) {
    where.status = "PENDING";
    where.requesterId = { not: f.awaitingApprovalFor };
  }
  if (f.decidedBy) {
    where.approvals = { some: { approverId: f.decidedBy } };
  }

  return prisma.request.findMany({
    where,
    include: {
      requester: { select: { id: true, fullName: true } },
      fromDepartment: { select: { id: true, code: true, name: true } },
      fromSection: { select: { id: true, code: true, name: true } },
      toDepartment: { select: { id: true, code: true, name: true } },
      toSection: { select: { id: true, code: true, name: true } },
      items: { include: { palletType: { select: { id: true, code: true, name: true } } } },
      approvals: {
        where: f.decidedBy ? { approverId: f.decidedBy } : undefined,
        include: { approver: { select: { id: true, fullName: true } } },
        orderBy: { decidedAt: "desc" },
      },
      _count: { select: { approvals: true, attachments: true } },
    },
    orderBy: { createdAt: "desc" },
    take: f.limit ?? 50,
    skip: f.offset ?? 0,
  });
}

export async function getRequestDetail(id: string) {
  return prisma.request.findUnique({
    where: { id },
    include: {
      requester: true,
      fromDepartment: true,
      fromSection: true,
      toDepartment: true,
      toSection: true,
      items: { include: { palletType: true } },
      approvals: {
        include: { approver: { select: { id: true, fullName: true } } },
        orderBy: { decidedAt: "asc" },
      },
      movements: true,
      attachments: true,
    },
  });
}

export { WAREHOUSE_DEPT_CODE };
