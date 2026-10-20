import { z } from "zod";
import { requireUser } from "@/lib/auth/current-user";
import { fail, ok, readJson } from "@/lib/http/respond";
import { createRequest, listRequests } from "@/lib/services/request";
import { notifyApproversOfNewRequest } from "@/lib/services/notification";
import type { StepSnapshot } from "@/lib/services/approval-route";

const RequestTypeEnum = z.enum(["ISSUE", "RETURN"]);

const StatusEnum = z.enum(["DRAFT", "PENDING_DEPT", "PENDING_WAREHOUSE", "COMPLETED", "REJECTED", "CANCELLED"]);

const ConditionEnum = z.enum(["GOOD", "PENDING_REPAIR", "DAMAGED"]);

const Create = z.object({
  type: RequestTypeEnum,
  condition: ConditionEnum.optional().nullable(),
  fromDepartmentId: z.string().optional().nullable(),
  fromSectionId: z.string().optional().nullable(),
  toDepartmentId: z.string().optional().nullable(),
  toSectionId: z.string().optional().nullable(),
  neededDate: z.coerce.date().optional().nullable(),
  purpose: z.string().max(500).optional().nullable(),
  note: z.string().max(1000).optional().nullable(),
  items: z
    .array(
      z.object({
        palletTypeId: z.string(),
        quantity: z.coerce.number().int().positive(),
        note: z.string().max(200).optional().nullable()
      })
    )
    .min(1)
});

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const scope = url.searchParams.get("scope");
    const rawStatus = url.searchParams.get("status");
    const type = url.searchParams.get("type") ?? undefined;

    const filter: Parameters<typeof listRequests>[0] = {};
    if (rawStatus) filter.status = StatusEnum.parse(rawStatus);
    if (type) filter.type = RequestTypeEnum.parse(type);

    if (scope === "mine") filter.requesterId = user.id;
    if (scope === "to-approve") filter.awaitingApprovalFor = user.id;
    if (scope === "i-approved") filter.decidedBy = user.id;

    let list = await listRequests(filter);

    if (scope === "to-approve") {
      const roles = user.roles as string[];
      list = list.filter((r) => {
        const snapshot = Array.isArray(r.stepSnapshot) ? (r.stepSnapshot as unknown as StepSnapshot[]) : [];

        let actingStep: number;
        if (r.status === "PENDING_DEPT" && r.currentStepOrder !== null) {
          const currentStep = snapshot.find((s) => s.stepOrder === r.currentStepOrder);
          if (!currentStep) return false;
          if (!currentStep.approverIds.includes(user.id) && !roles.includes("ADMIN")) return false;
          actingStep = r.currentStepOrder;
        } else if (r.status === "PENDING_WAREHOUSE") {
          if (!roles.some((role) => ["PALLET_MANAGER", "ADMIN"].includes(role))) return false;
          actingStep = snapshot.length + 1;
        } else {
          return false;
        }

        const alreadyApproved = (r.approvals as { approverId: string; step: number; decision: string }[]).some(
          (a) => a.approverId === user.id && a.step === actingStep && a.decision === "APPROVED"
        );
        return !alreadyApproved;
      });
    }

    return ok(list);
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const data = Create.parse(await readJson(req));
    const created = await createRequest(user, data);
    notifyApproversOfNewRequest(created.id).catch((e) => console.error("[notify]", e));
    return ok(created);
  } catch (e) {
    return fail(e);
  }
}
