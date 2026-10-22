import type { RequestType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/auth/current-user";
import type { SessionUser } from "@/lib/auth/current-user";

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------

export interface StepInput {
  stepOrder: number;
  name: string;
  approverIds: string[];
  requesterPicks?: boolean;
}

export interface RouteInput {
  departmentId: string;
  requestType: RequestType;
  steps: StepInput[];
  /**
   * Omit for create (will reject if an active route exists for the same
   * dept × type). Set to the existing route id for update.
   */
  id?: string;
}

// A step snapshot stored on the Request at submission time.
// If the route step has requesterPicks=true, approverIds is narrowed to
// the single approver chosen by the requester. The flag is also preserved
// so downstream UI can show "chosen by requester".
export interface StepSnapshot {
  stepOrder: number;
  name: string;
  approverIds: string[];
  requesterPicks?: boolean;
}

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

function requireAdmin(user: SessionUser) {
  if (!user.roles.includes("ADMIN")) throw new HttpError(403, "เฉพาะ Admin เท่านั้น");
}

const ROUTABLE_TYPES: RequestType[] = ["ISSUE", "RETURN"];

// -----------------------------------------------------------------------
// CRUD
// -----------------------------------------------------------------------

export async function listRoutes() {
  return prisma.approvalRoute.findMany({
    where: { isActive: true },
    include: {
      department: { select: { id: true, name: true } },
      steps: { orderBy: { stepOrder: "asc" } }
    },
    orderBy: [{ departmentId: "asc" }, { requestType: "asc" }]
  });
}

export async function getRoute(id: string) {
  return prisma.approvalRoute.findUnique({
    where: { id },
    include: {
      department: { select: { id: true, name: true } },
      steps: { orderBy: { stepOrder: "asc" } }
    }
  });
}

const MAX_STEPS = 10;

export async function upsertRoute(user: SessionUser, input: RouteInput) {
  requireAdmin(user);

  if (!ROUTABLE_TYPES.includes(input.requestType)) {
    throw new HttpError(400, `requestType ${input.requestType} ไม่รองรับ approval route`);
  }
  if (!input.steps.length) {
    throw new HttpError(400, "ต้องมีอย่างน้อย 1 ขั้น");
  }
  if (input.steps.length > MAX_STEPS) {
    throw new HttpError(400, `จำนวนขั้นเกินกำหนด (สูงสุด ${MAX_STEPS} ขั้น)`);
  }

  // Validate dept exists
  const dept = await prisma.department.findUnique({ where: { id: input.departmentId } });
  if (!dept) throw new HttpError(404, "ไม่พบแผนก");

  // Normalize + validate step orders are sequential starting at 1, name non-empty after trim
  const sorted = [...input.steps]
    .sort((a, b) => a.stepOrder - b.stepOrder)
    .map((s) => ({ ...s, name: s.name.trim() }));
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].stepOrder !== i + 1) {
      throw new HttpError(400, `stepOrder ต้องเรียงต่อกันจาก 1 (พบ ${sorted[i].stepOrder})`);
    }
    if (!sorted[i].name) {
      throw new HttpError(400, `ขั้นที่ ${sorted[i].stepOrder} ต้องระบุชื่อ`);
    }
    if (!sorted[i].approverIds.length) {
      throw new HttpError(400, `ขั้นที่ ${sorted[i].stepOrder} ต้องมีผู้อนุมัติอย่างน้อย 1 คน`);
    }
  }

  // Validate all approver user IDs exist AND have the DEPT_APPROVER role.
  // (The UI already filters by role, but defend against direct API calls.)
  const allIds = input.steps.flatMap((s) => s.approverIds);
  const uniqueIds = [...new Set(allIds)];
  if (uniqueIds.length) {
    const found = await prisma.user.findMany({
      where: { id: { in: uniqueIds }, status: "ACTIVE" },
      select: { id: true, fullName: true, roles: true }
    });
    if (found.length !== uniqueIds.length) {
      throw new HttpError(400, "มี userId ของผู้อนุมัติที่ไม่พบในระบบหรือไม่ active");
    }
    const notApprovers = found.filter((u) => !u.roles.includes("DEPT_APPROVER"));
    if (notApprovers.length > 0) {
      const names = notApprovers.map((u) => u.fullName).join(", ");
      throw new HttpError(400, `ผู้อนุมัติต้องมีสิทธิ์ DEPT_APPROVER: ${names}`);
    }
  }

  const existing = await prisma.approvalRoute.findUnique({
    where: { departmentId_requestType: { departmentId: input.departmentId, requestType: input.requestType } }
  });

  if (input.id) {
    // Update path — client is editing a known route. The (dept, type) must
    // match the record pointed at by id, otherwise this would silently
    // overwrite a different route.
    if (!existing || existing.id !== input.id) {
      throw new HttpError(400, "ข้อมูลที่ส่งไม่ตรงกับ route ที่ต้องการแก้ไข");
    }
  } else {
    // Create path — if an active route already exists for this (dept, type),
    // reject. Admin must delete the existing one first.
    if (existing && existing.isActive) {
      throw new HttpError(400, "แผนกนี้มี route สำหรับประเภทนี้แล้ว — กรุณาลบของเดิมก่อน");
    }
  }

  if (existing) {
    // Update (or re-activate a soft-deleted route): delete old steps, recreate
    await prisma.$transaction([
      prisma.approvalStep.deleteMany({ where: { routeId: existing.id } }),
      prisma.approvalRoute.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          updatedAt: new Date(),
          steps: {
            create: sorted.map((s) => ({
              stepOrder: s.stepOrder,
              name: s.name,
              approverIds: s.approverIds,
              requesterPicks: s.requesterPicks ?? false
            }))
          }
        }
      })
    ]);
    return prisma.approvalRoute.findUnique({
      where: { id: existing.id },
      include: { steps: { orderBy: { stepOrder: "asc" } } }
    });
  }

  return prisma.approvalRoute.create({
    data: {
      departmentId: input.departmentId,
      requestType: input.requestType,
      isActive: true,
      steps: {
        create: sorted.map((s) => ({
          stepOrder: s.stepOrder,
          name: s.name,
          approverIds: s.approverIds
        }))
      }
    },
    include: { steps: { orderBy: { stepOrder: "asc" } } }
  });
}

export async function deleteRoute(user: SessionUser, id: string) {
  requireAdmin(user);
  await prisma.approvalRoute.update({ where: { id }, data: { isActive: false } });
}

// -----------------------------------------------------------------------
// Route resolution (used by request service)
// -----------------------------------------------------------------------

/**
 * Resolve the approval route for a given dept + type at request submission time.
 * Returns the dept steps only (PM step is always the final implicit step).
 * Throws if no active route configured for that dept × type.
 */
export async function resolveRoute(departmentId: string, requestType: RequestType): Promise<StepSnapshot[]> {
  if (!ROUTABLE_TYPES.includes(requestType)) return [];

  const route = await prisma.approvalRoute.findFirst({
    where: { departmentId, requestType, isActive: true },
    include: { steps: { orderBy: { stepOrder: "asc" } } }
  });

  if (!route) {
    const dept = await prisma.department.findUnique({ where: { id: departmentId }, select: { name: true } });
    throw new HttpError(400, `แผนก "${dept?.name ?? departmentId}" ยังไม่ได้กำหนด approval route สำหรับ ${requestType} — กรุณาติดต่อ Admin`);
  }

  return route.steps.map((s) => ({
    stepOrder: s.stepOrder,
    name: s.name,
    approverIds: s.approverIds,
    requesterPicks: s.requesterPicks
  }));
}

/**
 * Returns an error message if removing userId from all steps they appear in
 * would leave any step with 0 approvers, otherwise null.
 */
export async function checkApproverRouteConflict(userId: string): Promise<string | null> {
  // Only consider steps on ACTIVE routes — removing an approver from a
  // soft-deleted route shouldn't block the admin from editing the user.
  const steps = await prisma.approvalStep.findMany({
    where: { approverIds: { has: userId }, route: { isActive: true } },
    include: { route: { include: { department: { select: { name: true } } } } }
  });

  const wouldEmpty = steps.filter((s) => s.approverIds.length === 1);
  if (wouldEmpty.length === 0) return null;

  const names = wouldEmpty.map((s) => `"${s.route.department.name}" ขั้น ${s.stepOrder} (${s.name})`).join(", ");
  return `ผู้ใช้นี้เป็นผู้อนุมัติขั้นตอนเดียวใน ${names} — กรุณาเพิ่มผู้อนุมัติสำรองก่อน`;
}

/**
 * Check whether a user can act on the current step of a request.
 * Returns the matching step or null.
 */
export function findActableStep(stepSnapshot: StepSnapshot[], currentStepOrder: number | null, userId: string): StepSnapshot | null {
  if (!currentStepOrder) return null;
  const step = stepSnapshot.find((s) => s.stepOrder === currentStepOrder);
  if (!step) return null;
  if (!step.approverIds.includes(userId)) return null;
  return step;
}

/**
 * Narrow a resolved step snapshot by the requester's picks. For every step
 * that has requesterPicks=true and more than one candidate approver, the
 * requester must supply a matching entry; the returned snapshot's approverIds
 * is narrowed to just that chosen user. Single-candidate pick steps are
 * passed through unchanged (auto-select).
 *
 * Throws HttpError(400) on: missing pick, pick not in approverIds, or pick
 * equal to the requester themselves.
 */
export function narrowStepsByPicks(
  steps: StepSnapshot[],
  picks: { stepOrder: number; approverId: string }[] | undefined,
  requesterId: string
): StepSnapshot[] {
  const map = new Map((picks ?? []).map((p) => [p.stepOrder, p.approverId]));
  return steps.map((s) => {
    if (!s.requesterPicks) return s;
    if (s.approverIds.length <= 1) return s;
    const pickedId = map.get(s.stepOrder);
    if (!pickedId) {
      throw new HttpError(400, `ขั้นที่ ${s.stepOrder} (${s.name}) กำหนดให้ผู้ขอเลือกผู้อนุมัติ 1 คน — กรุณาเลือกก่อนส่ง`);
    }
    if (!s.approverIds.includes(pickedId)) {
      throw new HttpError(400, `ผู้อนุมัติที่เลือกในขั้นที่ ${s.stepOrder} ไม่ได้อยู่ในรายชื่อผู้อนุมัติของขั้นนั้น`);
    }
    if (pickedId === requesterId) {
      throw new HttpError(400, `ขั้นที่ ${s.stepOrder} (${s.name}) — ไม่สามารถเลือกตัวเองเป็นผู้อนุมัติได้`);
    }
    return { ...s, approverIds: [pickedId] };
  });
}
