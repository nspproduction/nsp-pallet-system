// Library
import { z } from "zod";

// Lib
import { requireUser } from "@/lib/auth/current-user";
import { fail, ok, readJson } from "@/lib/http/respond";
import { editAndApprove } from "@/lib/services/request";

const Body = z.object({
  items: z
    .array(
      z.object({
        palletTypeId: z.string().min(1),
        condition: z.enum(["GOOD", "PENDING_REPAIR", "DAMAGED"]),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
  reason: z.string().min(1).max(1000),
  comment: z.string().max(500).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = Body.parse(await readJson(req));
    await editAndApprove(user, id, body.items, body.reason, body.comment);
    return ok({ done: true });
  } catch (e) {
    return fail(e);
  }
}
