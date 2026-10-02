import { z } from "zod";
import { requireUser } from "@/lib/auth/current-user";
import { fail, ok, readJson } from "@/lib/http/respond";
import { createUploadUrl } from "@/lib/services/attachment";

const Body = z.object({
  requestId: z.string(),
  filename: z.string().min(1).max(200),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = Body.parse(await readJson(req));
    return ok(await createUploadUrl({ requestId: body.requestId, filename: body.filename, userId: user.id }));
  } catch (e) {
    return fail(e);
  }
}
