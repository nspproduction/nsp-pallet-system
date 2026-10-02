import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/auth/current-user";

const BUCKET = "attachments";

function svc() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new HttpError(500, "Supabase env not set");
  return createClient(url, key, { auth: { persistSession: false } });
}

// Returns a signed upload URL that the browser can PUT to.
// Frontend flow:
//   1) POST /api/attachments/upload-url  → { path, token, signedUrl }
//   2) browser PUTs file to signedUrl with header: x-upsert:false
//   3) POST /api/attachments  { requestId, path, fileType, fileSize } → creates Attachment row
export async function createUploadUrl(params: {
  requestId: string;
  filename: string;
  userId: string;
}) {
  const safeName = params.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `requests/${params.requestId}/${Date.now()}-${safeName}`;
  const supa = svc();
  const { data, error } = await supa.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error) throw new HttpError(500, `signed url: ${error.message}`);
  return { path, token: data.token, signedUrl: data.signedUrl };
}

export async function registerAttachment(params: {
  requestId: string;
  userId: string;
  path: string;
  fileType?: string;
  fileSize?: number;
}) {
  const req = await prisma.request.findUnique({ where: { id: params.requestId } });
  if (!req) throw new HttpError(404, "request ไม่พบ");
  return prisma.attachment.create({
    data: {
      requestId: params.requestId,
      filePath: params.path,
      fileType: params.fileType ?? null,
      fileSize: params.fileSize ?? null,
      uploadedBy: params.userId,
    },
  });
}

// Signed URL for viewing (short-lived).
export async function getViewUrl(path: string): Promise<string> {
  const supa = svc();
  const { data, error } = await supa.storage.from(BUCKET).createSignedUrl(path, 60 * 10);
  if (error) throw new HttpError(500, `view url: ${error.message}`);
  return data.signedUrl;
}

export async function deleteAttachment(attachmentId: string) {
  const a = await prisma.attachment.findUnique({ where: { id: attachmentId } });
  if (!a) throw new HttpError(404, "attachment ไม่พบ");
  const supa = svc();
  await supa.storage.from(BUCKET).remove([a.filePath]);
  await prisma.attachment.delete({ where: { id: attachmentId } });
}
