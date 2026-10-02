import { z } from "zod";
import { requireUser } from "@/lib/auth/current-user";
import { fail, ok, readJson } from "@/lib/http/respond";
import { createRequest, listRequests } from "@/lib/services/request";
import { notifyApproversOfNewRequest } from "@/lib/services/notification";

const RequestTypeEnum = z.enum([
  "RECEIVE_NEW",
  "ISSUE_INTERNAL",
  "RETURN_INTERNAL",
  "TRANSFER_INTERNAL",
  "SHIP_CUSTOMER",
  "RETURN_CUSTOMER",
  "SEND_REPAIR",
  "RECEIVE_REPAIR",
  "WRITE_OFF",
  "ADJUSTMENT",
]);
const StatusEnum = z.enum(["DRAFT", "PENDING", "APPROVED", "FULFILLED", "REJECTED", "CANCELLED"]);
const ConditionEnum = z.enum(["USABLE", "IN_REPAIR", "UNUSABLE"]);

const Create = z.object({
  type: RequestTypeEnum,
  fromDepartmentId: z.string().optional().nullable(),
  fromSectionId: z.string().optional().nullable(),
  toDepartmentId: z.string().optional().nullable(),
  toSectionId: z.string().optional().nullable(),
  sectionId: z.string().optional().nullable(),
  neededDate: z.coerce.date().optional().nullable(),
  purpose: z.string().max(500).optional().nullable(),
  note: z.string().max(1000).optional().nullable(),
  items: z
    .array(
      z.object({
        palletTypeId: z.string(),
        condition: ConditionEnum,
        quantity: z.coerce.number().int().positive(),
        note: z.string().max(200).optional().nullable(),
      }),
    )
    .min(1),
});

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const scope = url.searchParams.get("scope");
    const status = url.searchParams.get("status") ?? undefined;
    const type = url.searchParams.get("type") ?? undefined;

    const filter: Parameters<typeof listRequests>[0] = {};
    if (status) filter.status = StatusEnum.parse(status);
    if (type) filter.type = RequestTypeEnum.parse(type);

    if (scope === "mine") filter.requesterId = user.id;
    if (scope === "to-approve") filter.awaitingApprovalFor = user.id;
    if (scope === "to-fulfill") filter.awaitingFulfillmentFor = user.id;

    const list = await listRequests(filter);
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
