import { z } from "zod";
import { requireUser } from "@/lib/auth/current-user";
import { fail, ok, readJson } from "@/lib/http/respond";
import { registerAttachment } from "@/lib/services/attachment";

const Body = z.object({
  requestId: z.string(),
  path: z.string(),
  fileType: z.string().optional(),
  fileSize: z.coerce.number().int().optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = Body.parse(await readJson(req));
    return ok(await registerAttachment({
      requestId: body.requestId,
      userId: user.id,
      path: body.path,
      fileType: body.fileType,
      fileSize: body.fileSize,
    }));
  } catch (e) {
    return fail(e);
  }
}
