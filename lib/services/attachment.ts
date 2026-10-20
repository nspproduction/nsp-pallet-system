import { prisma } from "@/lib/prisma";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const BUCKET = "request-attachments";
const SIGNED_URL_TTL = 60 * 60; // 1 hour

function extFor(mimeType: string) {
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("gif")) return "gif";
  if (mimeType.includes("webp")) return "webp";
  return "jpg";
}

export async function uploadAttachment(
  requestId: string,
  buffer: Buffer,
  mimeType: string,
  sizeBytes: number,
): Promise<{ id: string; filePath: string }> {
  const fileKey = crypto.randomUUID().replace(/-/g, "");
  const filePath = `requests/${requestId}/${fileKey}.${extFor(mimeType)}`;

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, buffer, { contentType: mimeType, upsert: false });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const att = await prisma.requestAttachment.create({
    data: { requestId, filePath, mimeType, sizeBytes },
  });

  return { id: att.id, filePath };
}

export async function getAttachmentViewUrl(attachmentId: string): Promise<string | null> {
  const att = await prisma.requestAttachment.findUnique({ where: { id: attachmentId } });
  if (!att) return null;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(att.filePath, SIGNED_URL_TTL);

  if (error || !data) return null;
  return data.signedUrl;
}
