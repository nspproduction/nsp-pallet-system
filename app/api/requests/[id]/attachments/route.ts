import { requireUser } from "@/lib/auth/current-user";
import { fail, ok } from "@/lib/http/respond";
import { prisma } from "@/lib/prisma";
import { uploadAttachment } from "@/lib/services/attachment";

const MAX_FILES = 5;
const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(req: Request, ctx: RouteContext<"/api/requests/[id]/attachments">) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;

    const request = await prisma.request.findUnique({
      where: { id },
      select: { requesterId: true },
    });
    if (!request) return Response.json({ error: "not_found" }, { status: 404 });

    const isOwner = request.requesterId === user.id;
    const isPrivileged = user.roles.some((r: string) => ["ADMIN", "PALLET_MANAGER"].includes(r));
    if (!isOwner && !isPrivileged) {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }

    const existing = await prisma.requestAttachment.count({ where: { requestId: id } });

    const formData = await req.formData();
    const files = formData.getAll("files") as File[];
    if (files.length === 0) return Response.json({ error: "no files" }, { status: 400 });
    if (existing + files.length > MAX_FILES) {
      return Response.json({ error: `แนบได้สูงสุด ${MAX_FILES} รูปต่อคำขอ` }, { status: 400 });
    }

    const results = await Promise.all(
      files.map(async (file) => {
        if (file.size > MAX_BYTES) throw new Error(`${file.name}: ขนาดเกิน 10 MB`);
        const buffer = Buffer.from(await file.arrayBuffer());
        return uploadAttachment(id, buffer, file.type || "image/jpeg", file.size);
      }),
    );

    return ok(results);
  } catch (e) {
    return fail(e);
  }
}
