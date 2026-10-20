import { Prisma } from "@prisma/client";
import type { PalletCondition, RequestType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/auth/current-user";
import { nextDocNo, nextWarehouseOpDocNo } from "@/lib/services/docno";
import { writeAudit } from "@/lib/services/audit";
import { resolveRoute, findActableStep } from "@/lib/services/approval-route";
import type { StepSnapshot } from "@/lib/services/approval-route";
import { checkOperatingHours } from "@/lib/services/operating-hours";
import { queueEmail, buildRequestEmail } from "@/lib/services/email-outbox";
import type { SessionUser } from "@/lib/auth/current-user";
import { moveStock } from "@/lib/server/stock";

// Types that consume from the warehouse on final approval
const CONSUMES_FROM_WAREHOUSE = new Set<RequestType>(["ISSUE"]);
// Types that need approval routing (all others skip routing)
const ROUTABLE = new Set<RequestType>(["ISSUE", "RETURN"]);
// Types only RETURN must have single condition
const SINGLE_CONDITION = new Set<RequestType>(["RETURN"]);

const TYPE_LABEL: Record<string, string> = {
  ISSUE: "เบิกออก",
  RETURN: "คืนเข้า"
};

function appUrl() {
  return process.env.APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
}

// -----------------------------------------------------------------------
// Input types
// -----------------------------------------------------------------------

export interface CreateRequestInput {
  type: RequestType;
  condition?: PalletCondition | null;
  fromDepartmentId?: string | null;
  fromSectionId?: string | null;
  toDepartmentId?: string | null;
  toSectionId?: string | null;
  neededDate?: Date | null;
  purpose?: string | null;
  note?: string | null;
  items: {
    palletTypeId: string;
    quantity: number;
    note?: string | null;
  }[];
}

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

async function getWarehouseDept() {
  const dept = await prisma.department.findFirst({
    where: { isWarehouse: true },
    select: { id: true, name: true, active: true }
  });
  if (!dept?.active) {
    throw new HttpError(500, "ยังไม่ได้ตั้งค่าแผนกคลังพาเลท (isWarehouse = true)");
  }
  return dept;
}

/** Current GOOD balance at the warehouse, minus in-flight outflow requests. */
export async function getAvailableBalance(params: { palletTypeId: string; condition: PalletCondition; departmentId: string }): Promise<number> {
  const [snap, reserved] = await Promise.all([
    prisma.warehouseStock.findUnique({
      where: { palletTypeId_condition: { palletTypeId: params.palletTypeId, condition: params.condition } }
    }),
    prisma.requestItem.aggregate({
      _sum: { quantity: true },
      where: {
        palletTypeId: params.palletTypeId,
        request: {
          condition: params.condition,
          fromDepartmentId: params.departmentId,
          status: { in: ["PENDING_DEPT", "PENDING_WAREHOUSE"] },
          type: { in: [...CONSUMES_FROM_WAREHOUSE] }
        }
      }
    })
  ]);
  return (snap?.quantity ?? 0) - (reserved._sum?.quantity ?? 0);
}

// -----------------------------------------------------------------------
// Create request
// -----------------------------------------------------------------------

export async function createRequest(user: SessionUser, input: CreateRequestInput) {
  if (!user.roles.some((r) => ["REQUESTER", "ADMIN"].includes(r))) {
    throw new HttpError(403, "บทบาทของคุณไม่สามารถสร้างคำขอได้");
  }
  if (!input.items?.length) throw new HttpError(400, "ต้องมี item อย่างน้อย 1 รายการ");
  for (const it of input.items) {
    if (it.quantity <= 0) throw new HttpError(400, "quantity ต้อง > 0");
  }

  const palletTypeIds = [...new Set(input.items.map((it) => it.palletTypeId))];
  const activePalletTypes = await prisma.palletType.findMany({
    where: { id: { in: palletTypeIds }, active: true },
    select: { id: true }
  });
  const activeIds = new Set(activePalletTypes.map((p) => p.id));
  const inactiveId = palletTypeIds.find((id) => !activeIds.has(id));
  if (inactiveId) throw new HttpError(400, "ประเภทพาเลทนี้ถูกปิดใช้งานแล้ว");

  const warehouse = await getWarehouseDept();

  // SINGLE_CONDITION types require a single condition at the request level
  if (SINGLE_CONDITION.has(input.type) && !input.condition) {
    throw new HttpError(400, "คำขอคืนเข้าต้องระบุสภาพพาเลท");
  }

  // ---- Auto-fill from/to departments ----
  let fromDepartmentId = input.fromDepartmentId ?? null;
  let fromSectionId = input.fromSectionId ?? null;
  let toDepartmentId = input.toDepartmentId ?? null;
  let toSectionId = input.toSectionId ?? null;

  switch (input.type) {
    case "ISSUE":
      fromDepartmentId = warehouse.id;
      fromSectionId = null;
      toDepartmentId = user.departmentId ?? null;
      toSectionId = user.sectionId ?? null;
      break;
    case "RETURN":
      fromDepartmentId = user.departmentId ?? null;
      fromSectionId = user.sectionId ?? null;
      toDepartmentId = warehouse.id;
      toSectionId = null;
      break;
    default:
      break;
  }

  if (input.type === "ISSUE" && !toDepartmentId) {
    throw new HttpError(400, "ผู้ร้องขอยังไม่ได้ผูกกับแผนก");
  }
  if (input.type === "RETURN" && !fromDepartmentId) {
    throw new HttpError(400, "ผู้ร้องขอยังไม่ได้ผูกกับแผนก");
  }

  const warnings: string[] = [];

  // ---- BR-2: warn (but allow) if GOOD balance is insufficient at submit time ----
  if (CONSUMES_FROM_WAREHOUSE.has(input.type) && fromDepartmentId && input.condition) {
    const agg = new Map<string, number>();
    for (const it of input.items) {
      agg.set(it.palletTypeId, (agg.get(it.palletTypeId) ?? 0) + it.quantity);
    }
    for (const [palletTypeId, qty] of agg.entries()) {
      const avail = await getAvailableBalance({
        palletTypeId,
        condition: input.condition,
        departmentId: fromDepartmentId
      });
      if (avail < qty) {
        warnings.push(`ยอด ${input.condition} คงเหลือไม่พอ: ต้องการ ${qty} ใบ, มีเพียง ${avail} ใบ`);
      }
    }
  }

  // ---- Operating hours check ----
  const { isOpen, nextOpenAt } = await checkOperatingHours();
  if (!isOpen) {
    throw new HttpError(400, `ขณะนี้อยู่นอกช่วงเวลาทำรายการ${nextOpenAt ? ` (เปิดถัดไป: ${nextOpenAt})` : ""}`);
  }

  // ---- Resolve approval route ----
  let stepSnapshot: StepSnapshot[] = [];
  let initialStatus: "PENDING_DEPT" | "PENDING_WAREHOUSE" | "COMPLETED" = "PENDING_WAREHOUSE";
  let currentStepOrder: number | null = null;

  if (ROUTABLE.has(input.type) && user.departmentId) {
    stepSnapshot = await resolveRoute(user.departmentId, input.type);
    if (stepSnapshot.length > 0) {
      initialStatus = "PENDING_DEPT";
      currentStepOrder = 1;
    }
  }

  const created = await prisma.$transaction(async (tx) => {
    const docNo = await nextDocNo(input.type, new Date(), tx);

    const req = await tx.request.create({
      data: {
        docNo,
        type: input.type,
        condition: input.condition ?? null,
        status: initialStatus,
        requesterId: user.id,
        fromDepartmentId,
        fromSectionId,
        toDepartmentId,
        toSectionId,
        currentStepOrder,
        stepSnapshot: stepSnapshot.length > 0 ? (stepSnapshot as unknown as Prisma.JsonArray) : Prisma.JsonNull,
        neededDate: input.neededDate ?? null,
        purpose: input.purpose ?? null,
        note: input.note ?? null,
        submittedAt: new Date(),
        items: {
          create: input.items.map((it) => ({
            palletTypeId: it.palletTypeId,
            quantity: it.quantity,
            note: it.note ?? null
          }))
        }
      },
      include: { items: true, requester: { select: { fullName: true } }, fromDepartment: { select: { name: true } } }
    });

    return req;
  });

  await writeAudit({ userId: user.id, entity: "request", entityId: created.id, action: "create", after: created });

  return { ...created, warnings };
}

// -----------------------------------------------------------------------
// Cancel
// -----------------------------------------------------------------------

export async function cancelRequest(user: SessionUser, requestId: string, reason?: string) {
  const r = await prisma.request.findUnique({ where: { id: requestId } });
  if (!r) throw new HttpError(404, "request ไม่พบ");
  if (r.requesterId !== user.id && !user.roles.includes("ADMIN")) throw new HttpError(403, "ไม่มีสิทธิ์ยกเลิก");
  const cancellableStatuses = ["PENDING_DEPT", "PENDING_WAREHOUSE"];
  if (!cancellableStatuses.includes(r.status)) {
    throw new HttpError(400, "ยกเลิกได้เฉพาะคำขอที่ยังรออนุมัติ (ก่อนการอนุมัติขั้นแรก)");
  }
  // Only allow requester to cancel before first approval action
  if (r.requesterId === user.id && !user.roles.includes("ADMIN")) {
    const anyApproval = await prisma.approval.findFirst({ where: { requestId } });
    if (anyApproval) throw new HttpError(400, "มีผู้อนุมัติแล้ว ไม่สามารถยกเลิกได้");
  }

  const updated = await prisma.request.update({
    where: { id: requestId },
    data: { status: "CANCELLED", cancelledAt: new Date(), note: reason ?? r.note }
  });
  await writeAudit({ userId: user.id, entity: "request", entityId: requestId, action: "cancel", after: { status: "CANCELLED", reason } });
  return updated;
}

// -----------------------------------------------------------------------
// Approve (multi-step)
// -----------------------------------------------------------------------

export async function approveRequest(user: SessionUser, requestId: string, comment?: string) {
  if (!user.roles.some((r) => ["DEPT_APPROVER", "PALLET_MANAGER", "ADMIN"].includes(r))) throw new HttpError(403, "ต้องมีสิทธิ์ผู้อนุมัติ");

  const r = await prisma.request.findUnique({ where: { id: requestId }, include: { items: true } });
  if (!r) throw new HttpError(404, "request ไม่พบ");
  if (r.requesterId === user.id) throw new HttpError(400, "ผู้ร้องขอกับผู้อนุมัติต้องไม่ใช่คนเดียวกัน");

  const isActive = ["PENDING_DEPT", "PENDING_WAREHOUSE"].includes(r.status);
  if (!isActive) throw new HttpError(400, `ไม่สามารถอนุมัติคำขอสถานะ ${r.status}`);

  // ---- Determine which step this user is approving ----
  const snapshot = (r.stepSnapshot as StepSnapshot[] | null) ?? [];

  let actingStep = 0;
  let actingStepName = "คลังพาเลท";

  if (r.status === "PENDING_DEPT" && r.currentStepOrder) {
    const step = findActableStep(snapshot, r.currentStepOrder, user.id);
    if (!step && !user.roles.includes("ADMIN")) {
      throw new HttpError(403, "คุณไม่ได้อยู่ในรายชื่อผู้อนุมัติสำหรับขั้นนี้");
    }
    actingStep = r.currentStepOrder;
    actingStepName = step?.name ?? `ขั้น ${r.currentStepOrder}`;
  } else if (r.status === "PENDING_WAREHOUSE") {
    // Final step — only APPROVER or ADMIN can approve
    actingStep = snapshot.length + 1;
    actingStepName = "คลังพาเลท";
  }

  // ---- Prevent double-approving same step ----
  if (actingStep > 0) {
    const already = await prisma.approval.findFirst({
      where: { requestId, approverId: user.id, step: actingStep, decision: "APPROVED" }
    });
    if (already) throw new HttpError(400, "คุณอนุมัติขั้นนี้ไปแล้ว");
  }

  const isFinalStep = r.status === "PENDING_WAREHOUSE";
  const nextDeptStep = snapshot.find((s) => s.stepOrder === (r.currentStepOrder ?? 0) + 1);

  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    // Record approval
    await tx.approval.create({
      data: {
        requestId,
        approverId: user.id,
        decision: "APPROVED",
        comment: comment ?? null,
        step: actingStep,
        stepName: actingStepName,
        decidedAt: now
      }
    });

    if (isFinalStep) {
      // Write stock movements via stock service (Rule 1, Rule 3)
      for (const it of r.items) {
        await moveStock(tx, {
          palletTypeId: it.palletTypeId,
          condition: r.condition ?? "GOOD",
          delta: r.type === "ISSUE" ? -it.quantity : it.quantity,
          fromDepartmentId: r.fromDepartmentId ?? null,
          fromSectionId: r.fromSectionId ?? null,
          toDepartmentId: r.toDepartmentId ?? null,
          toSectionId: r.toSectionId ?? null,
          requestId: r.id,
          reason: `Request ${r.docNo}`,
          occurredAt: now
        });
      }

      // Queue email to requester
      const req = await tx.request.findUnique({
        where: { id: requestId },
        include: {
          requester: { select: { email: true, fullName: true } },
          fromDepartment: { select: { name: true } },
          items: { include: { palletType: { select: { name: true } } } }
        }
      });
      if (req?.requester.email) {
        const itemsSummary = req.items.map((i) => `${i.palletType.name} × ${i.quantity}`).join(", ");
        await queueEmail(
          tx,
          req.requester.email,
          `[อนุมัติแล้ว] ${req.docNo} — ${TYPE_LABEL[req.type] ?? req.type}`,
          buildRequestEmail({
            title: "คำขอได้รับการอนุมัติ",
            docNo: req.docNo,
            typeLabel: TYPE_LABEL[req.type] ?? req.type,
            requesterName: req.requester.fullName,
            departmentName: req.fromDepartment?.name ?? "-",
            itemsSummary,
            statusText: "อนุมัติแล้ว",
            comment,
            appUrl: appUrl(),
            requestId: r.id
          })
        );
      }

      return tx.request.update({
        where: { id: requestId },
        data: { status: "COMPLETED", completedAt: now, currentStepOrder: null }
      });
    }

    // Advance to next dept step or to PENDING_WAREHOUSE
    if (nextDeptStep) {
      return tx.request.update({
        where: { id: requestId },
        data: { status: "PENDING_DEPT", currentStepOrder: nextDeptStep.stepOrder }
      });
    }

    return tx.request.update({
      where: { id: requestId },
      data: { status: "PENDING_WAREHOUSE", currentStepOrder: null }
    });
  });

  await writeAudit({ userId: user.id, entity: "request", entityId: requestId, action: "approve", after: { step: actingStep, comment } });
  return updated;
}

// -----------------------------------------------------------------------
// Reject
// -----------------------------------------------------------------------

export async function rejectRequest(user: SessionUser, requestId: string, comment: string) {
  if (!user.roles.some((r) => ["DEPT_APPROVER", "PALLET_MANAGER", "ADMIN"].includes(r))) throw new HttpError(403, "ต้องมีสิทธิ์ผู้อนุมัติ");
  if (!comment?.trim()) throw new HttpError(400, "ต้องระบุเหตุผลการปฏิเสธ");

  const r = await prisma.request.findUnique({ where: { id: requestId } });
  if (!r) throw new HttpError(404, "request ไม่พบ");
  if (!["PENDING_DEPT", "PENDING_WAREHOUSE"].includes(r.status)) {
    throw new HttpError(400, `ปฏิเสธได้เฉพาะคำขอที่รออนุมัติ (สถานะปัจจุบัน: ${r.status})`);
  }
  if (r.requesterId === user.id) throw new HttpError(400, "ผู้ร้องขอกับผู้อนุมัติต้องไม่ใช่คนเดียวกัน");

  const snapshot = (r.stepSnapshot as StepSnapshot[] | null) ?? [];
  const actingStep = r.currentStepOrder ?? snapshot.length + 1;

  const [updated] = await prisma.$transaction([
    prisma.request.update({
      where: { id: requestId },
      data: { status: "REJECTED", currentStepOrder: null }
    }),
    prisma.approval.create({
      data: {
        requestId,
        approverId: user.id,
        decision: "REJECTED",
        comment,
        step: actingStep,
        stepName: r.status === "PENDING_WAREHOUSE" ? "คลังพาเลท" : `ขั้น ${actingStep}`,
        decidedAt: new Date()
      }
    })
  ]);

  await writeAudit({ userId: user.id, entity: "request", entityId: requestId, action: "reject", after: { comment } });
  return updated;
}

// -----------------------------------------------------------------------
// Edit-and-approve (Pallet Manager / Admin)
// -----------------------------------------------------------------------

export async function editAndApprove(
  user: SessionUser,
  requestId: string,
  items: { palletTypeId: string; condition: PalletCondition; quantity: number }[],
  reason: string,
  comment?: string
) {
  if (!user.roles.some((r) => ["PALLET_MANAGER", "ADMIN"].includes(r))) throw new HttpError(403, "ต้องมีสิทธิ์ผู้อนุมัติ");
  if (!reason?.trim()) throw new HttpError(400, "ต้องระบุเหตุผลการแก้ไข");
  if (!items.length) throw new HttpError(400, "ต้องมี item อย่างน้อย 1 รายการ");

  const r = await prisma.request.findUnique({ where: { id: requestId }, include: { items: true } });
  if (!r) throw new HttpError(404, "request ไม่พบ");
  if (r.status !== "PENDING_WAREHOUSE") {
    throw new HttpError(400, "แก้ไขได้เฉพาะคำขอที่รอขั้น Pallet Manager");
  }
  if (r.requesterId === user.id) throw new HttpError(400, "ผู้ร้องขอกับผู้อนุมัติต้องไม่ใช่คนเดียวกัน");

  const before = { items: r.items };
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    // Delete old items and recreate
    await tx.requestItem.deleteMany({ where: { requestId } });
    await tx.requestItem.createMany({
      data: items.map((it) => ({ requestId, ...it }))
    });

    // Record revision
    await tx.requestRevision.create({
      data: {
        requestId,
        editedById: user.id,
        reason,
        before: before as Prisma.InputJsonValue,
        after: { items },
        createdAt: now
      }
    });

    // Write stock movements via stock service (Rule 1, Rule 3)
    for (const it of items) {
      await moveStock(tx, {
        palletTypeId: it.palletTypeId,
        condition: it.condition ?? r.condition ?? "GOOD",
        delta: r.type === "ISSUE" ? -it.quantity : it.quantity,
        fromDepartmentId: r.fromDepartmentId ?? null,
        toDepartmentId: r.toDepartmentId ?? null,
        requestId: r.id,
        reason: `Request ${r.docNo} (แก้ไข)`,
        occurredAt: now
      });
    }

    // Record approval
    await tx.approval.create({
      data: {
        requestId,
        approverId: user.id,
        decision: "APPROVED",
        comment: comment ?? null,
        step: ((r.stepSnapshot as StepSnapshot[] | null)?.length ?? 0) + 1,
        stepName: "คลังพาเลท (แก้ไข)",
        decidedAt: now
      }
    });

    // Notify requester
    const req = await tx.request.findUnique({
      where: { id: requestId },
      include: {
        requester: { select: { email: true, fullName: true } },
        fromDepartment: { select: { name: true } }
      }
    });
    if (req?.requester.email) {
      await queueEmail(
        tx,
        req.requester.email,
        `[แก้ไขและอนุมัติ] ${r.docNo} — ${TYPE_LABEL[r.type] ?? r.type}`,
        buildRequestEmail({
          title: "คำขอถูกแก้ไขและอนุมัติโดยคลัง",
          docNo: r.docNo,
          typeLabel: TYPE_LABEL[r.type] ?? r.type,
          requesterName: req.requester.fullName,
          departmentName: req.fromDepartment?.name ?? "-",
          itemsSummary: items.map((i) => `${i.palletTypeId} × ${i.quantity}`).join(", "),
          statusText: "แก้ไขและอนุมัติแล้ว",
          comment: reason,
          appUrl: appUrl(),
          requestId: r.id
        })
      );
    }

    await tx.request.update({
      where: { id: requestId },
      data: { status: "COMPLETED", completedAt: now, currentStepOrder: null, updatedAt: now }
    });
  });

  await writeAudit({
    userId: user.id,
    entity: "request",
    entityId: requestId,
    action: "edit_approve",
    before,
    after: { items, reason }
  });
}

// -----------------------------------------------------------------------
// Admin adjustment (bypass workflow)
// -----------------------------------------------------------------------

export async function adjustStock(
  user: SessionUser,
  input: {
    palletTypeId: string;
    condition: PalletCondition;
    fromDepartmentId?: string | null;
    toDepartmentId?: string | null;
    quantity: number;
    reason: string;
  }
) {
  if (!user.roles.includes("ADMIN")) throw new HttpError(403, "เฉพาะ Admin เท่านั้น");
  if (input.quantity <= 0) throw new HttpError(400, "quantity ต้อง > 0");
  if (!input.reason?.trim()) throw new HttpError(400, "ต้องระบุเหตุผลการปรับยอด");
  if (!input.fromDepartmentId && !input.toDepartmentId) {
    throw new HttpError(400, "ต้องระบุ fromDepartment หรือ toDepartment อย่างน้อย 1 อย่าง");
  }

  const warehouse = await getWarehouseDept();
  const reason = `[ADJUST] ${input.reason.trim()}`;
  const now = new Date();

  // Adjustments must involve the warehouse on at least one side.
  // Inflow (warehouse receives): delta = +quantity
  // Outflow (warehouse sends): delta = -quantity
  const warehouseReceives = input.toDepartmentId === warehouse.id;
  const warehouseSends = input.fromDepartmentId === warehouse.id;
  if (!warehouseReceives && !warehouseSends) {
    throw new HttpError(400, "การปรับยอดต้องเกี่ยวข้องกับคลังพาเลทอย่างน้อยหนึ่งด้าน");
  }
  const delta = warehouseReceives ? input.quantity : -input.quantity;

  const { randomUUID } = await import("node:crypto");
  const groupId = randomUUID();
  const docNo = await nextWarehouseOpDocNo("ADJUSTMENT", now);

  await prisma.$transaction(async (tx) => {
    // Record the warehouse operation so dashboard reports can categorize this
    // movement as an "ADJUSTMENT" (via stockMovement.warehouseOpId → warehouseOp.type).
    await tx.warehouseOperation.create({
      data: { id: groupId, docNo, type: "ADJUSTMENT", reason, createdById: user.id, createdAt: now }
    });
    await moveStock(tx, {
      palletTypeId: input.palletTypeId,
      condition: input.condition,
      delta,
      fromDepartmentId: input.fromDepartmentId ?? null,
      toDepartmentId: input.toDepartmentId ?? null,
      warehouseOpId: groupId,
      movementGroupId: groupId,
      reason,
      occurredAt: now
    });
  });

  await writeAudit({ userId: user.id, entity: "warehouse_operation", entityId: groupId, action: "adjust", after: input });
  return { ok: true, groupId };
}

// -----------------------------------------------------------------------
// List / Get queries
// -----------------------------------------------------------------------

export type RequestListFilter = {
  status?: Prisma.RequestWhereInput["status"];
  type?: Prisma.RequestWhereInput["type"];
  requesterId?: string;
  awaitingApprovalFor?: string;
  decidedBy?: string;
  limit?: number;
  offset?: number;
};

function buildRequestWhere(f: RequestListFilter): Prisma.RequestWhereInput {
  const where: Prisma.RequestWhereInput = {};
  if (f.status) where.status = f.status;
  if (f.type) where.type = f.type;
  if (f.requesterId) where.requesterId = f.requesterId;

  if (f.awaitingApprovalFor) {
    where.status = { in: ["PENDING_DEPT", "PENDING_WAREHOUSE"] };
    where.requesterId = { not: f.awaitingApprovalFor };
  }

  if (f.decidedBy) {
    where.approvals = { some: { approverId: f.decidedBy } };
  }

  return where;
}

export async function countRequests(f: RequestListFilter = {}): Promise<number> {
  return prisma.request.count({ where: buildRequestWhere(f) });
}

export async function listRequests(f: RequestListFilter = {}) {
  const where = buildRequestWhere(f);

  return prisma.request.findMany({
    where,
    include: {
      requester: { select: { id: true, fullName: true } },
      fromDepartment: { select: { id: true, name: true } },
      fromSection: { select: { id: true, name: true } },
      toDepartment: { select: { id: true, name: true } },
      toSection: { select: { id: true, name: true } },
      items: { include: { palletType: { select: { id: true, name: true } } } },
      approvals: {
        where: f.decidedBy ? { approverId: f.decidedBy } : undefined,
        include: { approver: { select: { id: true, fullName: true } } },
        orderBy: { decidedAt: "desc" }
      },
      revisions: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { approvals: true } }
    },
    orderBy: [{ createdAt: "desc" }],
    take: f.limit ?? 50,
    skip: f.offset ?? 0
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
        orderBy: { decidedAt: "asc" }
      },
      revisions: {
        include: { editedBy: { select: { id: true, fullName: true } } },
        orderBy: { createdAt: "asc" }
      },
      attachments: { select: { id: true, filePath: true } },
      movements: true
    }
  });
}

/**
 * BR-2 warnings for an existing request (used by the approval page).
 * BR-2: warns when warehouse stock is insufficient for an ISSUE request.
 */
export async function getRequestWarnings(requestId: string): Promise<string[]> {
  const r = await prisma.request.findUnique({
    where: { id: requestId },
    include: { items: true }
  });
  if (!r) return [];

  const warnings: string[] = [];

  if (r.type === "ISSUE" && r.fromDepartmentId) {
    const condition = r.condition ?? "GOOD";
    for (const it of r.items) {
      const snap = await prisma.warehouseStock.findUnique({
        where: { palletTypeId_condition: { palletTypeId: it.palletTypeId, condition } }
      });
      const avail = snap?.quantity ?? 0;
      if (avail < it.quantity) {
        warnings.push(`ยอด ${condition} ในคลังไม่พอ: ต้องการ ${it.quantity} ใบ, คงเหลือ ${avail} ใบ`);
      }
    }
  }

  return warnings;
}
