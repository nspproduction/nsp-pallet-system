import { prisma } from "@/lib/prisma";

// Minimal LINE Messaging API push wrapper.
// Docs: https://developers.line.biz/en/reference/messaging-api/#send-push-message
const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";

interface LinePushBody {
  to: string;
  messages: unknown[];
}

async function linePush(body: LinePushBody): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return { ok: false, error: "LINE_CHANNEL_ACCESS_TOKEN not set" };

  try {
    const res = await fetch(LINE_PUSH_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!res.ok) {
      const t = await res.text();
      return { ok: false, error: `LINE push ${res.status}: ${t}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function record(userId: string, subject: string, body: string, linkUrl?: string, error?: string) {
  await prisma.notification.create({
    data: {
      userId,
      channel: "LINE",
      subject,
      body,
      linkUrl: linkUrl ?? null,
      sentAt: error ? null : new Date(),
      error: error ?? null,
    },
  });
}

// -----------------------------------------------------------------------------
// Flex messages
// -----------------------------------------------------------------------------

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
}

function requestFlex(opts: {
  title: string;
  headerColor: string;
  docNo: string;
  typeLabel: string;
  requesterName: string;
  itemsSummary: string;
  linkUrl: string;
  ctaLabel: string;
}) {
  return {
    type: "flex",
    altText: `${opts.title} · ${opts.docNo}`,
    contents: {
      type: "bubble",
      size: "kilo",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: opts.headerColor,
        paddingAll: "12px",
        contents: [
          { type: "text", text: opts.title, color: "#ffffff", weight: "bold", size: "md" },
          { type: "text", text: opts.docNo, color: "#ffffff", size: "xs" },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          row("ประเภท", opts.typeLabel),
          row("ผู้ร้องขอ", opts.requesterName),
          row("รายการ", opts.itemsSummary),
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "button",
            style: "primary",
            action: { type: "uri", label: opts.ctaLabel, uri: opts.linkUrl },
          },
        ],
      },
    },
  };
}

function row(label: string, value: string) {
  return {
    type: "box",
    layout: "baseline",
    spacing: "sm",
    contents: [
      { type: "text", text: label, size: "sm", color: "#8a94a7", flex: 2 },
      { type: "text", text: value, size: "sm", color: "#111827", flex: 5, wrap: true },
    ],
  };
}

const TYPE_LABEL: Record<string, string> = {
  RECEIVE_NEW: "รับเข้าใหม่",
  ISSUE_INTERNAL: "เบิกใช้ภายใน",
  RETURN_INTERNAL: "คืนจากภายใน",
  SHIP_CUSTOMER: "ส่งลูกค้า",
  RETURN_CUSTOMER: "รับคืนจากลูกค้า",
  SEND_REPAIR: "ส่งซ่อม",
  RECEIVE_REPAIR: "รับคืนจากซ่อม",
  WRITE_OFF: "ตัดจำหน่าย",
  ADJUSTMENT: "ปรับยอด",
};

// -----------------------------------------------------------------------------
// Notification triggers
// -----------------------------------------------------------------------------

export async function notifyApproversOfNewRequest(requestId: string) {
  const r = await prisma.request.findUnique({
    where: { id: requestId },
    include: {
      requester: true,
      items: { include: { palletType: true } },
    },
  });
  if (!r) return;

  const approvers = await prisma.user.findMany({
    where: { role: { in: ["APPROVER", "ADMIN"] }, status: "ACTIVE", lineUserId: { not: null } },
  });

  const itemsSummary = r.items
    .map((it) => `${it.palletType.name} × ${it.quantity}`)
    .join(", ")
    .slice(0, 200);
  const link = `${baseUrl()}/liff/approvals`;

  const flex = requestFlex({
    title: "คำขอใหม่รออนุมัติ",
    headerColor: "#4f46e5",
    docNo: r.docNo,
    typeLabel: TYPE_LABEL[r.type] ?? r.type,
    requesterName: r.requester.fullName,
    itemsSummary,
    linkUrl: link,
    ctaLabel: "ดูรายการอนุมัติ",
  });

  await Promise.all(
    approvers.map(async (a) => {
      if (a.id === r.requesterId || !a.lineUserId) return;
      const res = await linePush({ to: a.lineUserId, messages: [flex] });
      await record(a.id, "คำขอใหม่รออนุมัติ", `${r.docNo}`, link, res.error);
    }),
  );
}

export async function notifyRequesterOfDecision(requestId: string, decision: "APPROVED" | "REJECTED", comment?: string) {
  const r = await prisma.request.findUnique({
    where: { id: requestId },
    include: { requester: true, items: { include: { palletType: true } } },
  });
  if (!r || !r.requester.lineUserId) return;

  const link = `${baseUrl()}/liff/requests/${r.id}`;
  const flex = requestFlex({
    title: decision === "APPROVED" ? "คำขอได้รับการอนุมัติ" : "คำขอถูกปฏิเสธ",
    headerColor: decision === "APPROVED" ? "#16a34a" : "#e11d48",
    docNo: r.docNo,
    typeLabel: TYPE_LABEL[r.type] ?? r.type,
    requesterName: r.requester.fullName,
    itemsSummary: comment || (decision === "APPROVED" ? "อนุมัติแล้ว" : "โปรดตรวจสอบ"),
    linkUrl: link,
    ctaLabel: "ดูรายละเอียด",
  });

  const res = await linePush({ to: r.requester.lineUserId, messages: [flex] });
  await record(r.requester.id, decision === "APPROVED" ? "คำขอได้รับการอนุมัติ" : "คำขอถูกปฏิเสธ", r.docNo, link, res.error);
}

export async function notifyLowStock(palletTypeId: string, currentBalance: number) {
  const pt = await prisma.palletType.findUnique({ where: { id: palletTypeId } });
  if (!pt) return;
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", status: "ACTIVE", lineUserId: { not: null } },
  });
  const text = `⚠️ ${pt.name} คงเหลือ ${currentBalance} (ต่ำกว่าเกณฑ์ ${pt.minStock})`;
  await Promise.all(
    admins.map(async (a) => {
      if (!a.lineUserId) return;
      const res = await linePush({ to: a.lineUserId, messages: [{ type: "text", text }] });
      await record(a.id, "แจ้งเตือนสต็อกต่ำ", text, undefined, res.error);
    }),
  );
}
