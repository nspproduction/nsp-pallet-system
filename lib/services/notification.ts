import { prisma } from "@/lib/prisma";
import { queueEmail, buildRequestEmail, buildUserEmail } from "@/lib/services/email-outbox";

// -----------------------------------------------------------------------------
// Internal helpers
// -----------------------------------------------------------------------------

function baseUrl(): string {
  return process.env.APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
}

/** Create an in-app Notification record for a user. */
async function record(params: { userId: string; subject?: string; body: string; linkUrl?: string; requestId?: string }) {
  await prisma.notification.create({
    data: {
      userId: params.userId,
      subject: params.subject ?? null,
      body: params.body,
      linkUrl: params.linkUrl ?? null,
      requestId: params.requestId ?? null
    }
  });
}

const TYPE_LABEL: Record<string, string> = {
  ISSUE: "เบิกออก",
  RETURN: "คืนเข้า"
};

// -----------------------------------------------------------------------------
// Notification triggers
// -----------------------------------------------------------------------------

export async function notifyApproversOfNewRequest(requestId: string) {
  const r = await prisma.request.findUnique({
    where: { id: requestId },
    include: {
      requester: true,
      fromDepartment: { select: { name: true } },
      items: { include: { palletType: true } }
    }
  });
  if (!r) return;

  // Resolve who should be notified based on current approval state.
  const snapshot = r.stepSnapshot as Array<{ stepOrder: number; approverIds: string[] }> | null;
  const currentStep = snapshot?.find((s) => s.stepOrder === r.currentStepOrder);

  const approvers = await prisma.user.findMany({
    where: {
      ...(currentStep
        ? // PENDING_DEPT: notify only the specific approvers for this step
          { id: { in: currentStep.approverIds } }
        : // PENDING_WAREHOUSE: notify only PALLET_MANAGER
          { roles: { has: "PALLET_MANAGER" } }),
      status: "ACTIVE"
    }
  });

  const itemsSummary = r.items
    .map((it) => `${it.palletType.name} × ${it.quantity}`)
    .join(", ")
    .slice(0, 200);
  const link = `${baseUrl()}/manage/requests/${r.id}`;
  const subject = "คำขอใหม่รออนุมัติ";

  await Promise.all(
    approvers.map(async (a) => {
      if (a.id === r.requesterId) return;
      await record({ userId: a.id, subject, body: `${r.docNo} — ${itemsSummary}`, linkUrl: link, requestId: r.id });
      if (a.email) {
        await queueEmail(
          prisma,
          a.email,
          `[รออนุมัติ] ${r.docNo} — ${TYPE_LABEL[r.type] ?? r.type}`,
          buildRequestEmail({
            title: subject,
            docNo: r.docNo,
            typeLabel: TYPE_LABEL[r.type] ?? r.type,
            requesterName: r.requester.fullName,
            departmentName: r.fromDepartment?.name ?? "-",
            itemsSummary,
            statusText: "รออนุมัติ",
            appUrl: baseUrl(),
            requestId: r.id
          })
        );
      }
    })
  );
}

export async function notifyRequestCompleted(requestId: string) {
  const r = await prisma.request.findUnique({
    where: { id: requestId },
    include: { requester: true, items: { include: { palletType: true } } }
  });
  // Only notify when the request is truly completed (email already queued inside the approval transaction)
  if (!r || r.status !== "COMPLETED") return;

  const link = `${baseUrl()}/app/requests/${r.id}`;
  await record({ userId: r.requesterId, subject: "คำขอได้รับการอนุมัติ", body: r.docNo, linkUrl: link, requestId: r.id });
}

export async function notifyRequestRejected(requestId: string, comment?: string) {
  const r = await prisma.request.findUnique({
    where: { id: requestId },
    include: { requester: true, items: { include: { palletType: true } } }
  });
  if (!r) return;

  const link = `${baseUrl()}/app/requests/${r.id}`;
  const subject = "คำขอถูกปฏิเสธ";
  const itemsSummary = r.items.map((it) => `${it.palletType.name} × ${it.quantity}`).join(", ");

  await record({ userId: r.requesterId, subject, body: `${r.docNo}${comment ? ` — ${comment}` : ""}`, linkUrl: link, requestId: r.id });

  if (r.requester.email) {
    await queueEmail(
      prisma,
      r.requester.email,
      `[ปฏิเสธ] ${r.docNo} — ${TYPE_LABEL[r.type] ?? r.type}`,
      buildRequestEmail({
        title: subject,
        docNo: r.docNo,
        typeLabel: TYPE_LABEL[r.type] ?? r.type,
        requesterName: r.requester.fullName,
        departmentName: "-",
        itemsSummary,
        statusText: "ปฏิเสธ",
        comment,
        appUrl: baseUrl(),
        requestId: r.id
      })
    );
  }
}

export async function notifyEditApproved(requestId: string) {
  const r = await prisma.request.findUnique({
    where: { id: requestId },
    include: { requester: true, items: { include: { palletType: true } } }
  });
  if (!r) return;

  const link = `${baseUrl()}/app/requests/${r.id}`;
  const subject = "คำขอถูกแก้ไขและอนุมัติโดยคลัง";
  const itemsSummary = r.items.map((it) => `${it.palletType.name} × ${it.quantity}`).join(", ");

  await record({ userId: r.requesterId, subject, body: r.docNo, linkUrl: link, requestId: r.id });

  if (r.requester.email) {
    await queueEmail(
      prisma,
      r.requester.email,
      `[แก้ไขและอนุมัติ] ${r.docNo} — ${TYPE_LABEL[r.type] ?? r.type}`,
      buildRequestEmail({
        title: subject,
        docNo: r.docNo,
        typeLabel: TYPE_LABEL[r.type] ?? r.type,
        requesterName: r.requester.fullName,
        departmentName: "-",
        itemsSummary,
        statusText: "แก้ไขและอนุมัติแล้ว",
        appUrl: baseUrl(),
        requestId: r.id
      })
    );
  }
}

export async function notifyNewUserToAdmins(userId: string) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    include: { department: true }
  });
  if (!u) return;

  const admins = await prisma.user.findMany({
    where: { roles: { has: "ADMIN" }, status: "ACTIVE" }
  });

  const subject = "ผู้ใช้ใหม่รอยืนยัน";
  const body = `${u.fullName} (${u.email}) รอการยืนยัน`;
  const link = `${baseUrl()}/manage/users`;

  // In-app + email to every admin
  for (const a of admins) {
    await record({ userId: a.id, subject, body, linkUrl: link });
    if (a.email) {
      await queueEmail(
        prisma,
        a.email,
        `[รอยืนยัน] ผู้ใช้ใหม่ — ${u.fullName}`,
        buildUserEmail({
          title: "ผู้ใช้ใหม่รอการยืนยัน",
          bodyLines: [
            `ชื่อ: <strong>${u.fullName}</strong>`,
            `อีเมล: ${u.email}`,
            `แผนก: ${u.department?.name ?? "-"}`,
            "กรุณาเข้าไปอนุมัติหรือปฏิเสธบัญชีนี้"
          ],
          ctaText: "จัดการผู้ใช้",
          ctaUrl: link
        })
      );
    }
  }

  // Confirmation email to the registering user
  if (u.email) {
    await queueEmail(
      prisma,
      u.email,
      "รับใบสมัครของคุณแล้ว — รอการยืนยันจากผู้ดูแลระบบ",
      buildUserEmail({
        title: "ได้รับใบสมัครของคุณแล้ว",
        bodyLines: [
          `สวัสดีคุณ <strong>${u.fullName}</strong>`,
          "ขอบคุณที่สมัครใช้งานระบบเบิก/คืนพาเลท ระบบได้รับใบสมัครของคุณเรียบร้อยแล้ว",
          "ผู้ดูแลระบบจะตรวจสอบข้อมูลและแจ้งผลการอนุมัติกลับมาทางอีเมลนี้"
        ],
        summaryRows: [
          { label: "ชื่อ-นามสกุล", value: u.fullName },
          { label: "อีเมล", value: u.email },
          { label: "แผนก", value: u.department?.name ?? "-" },
          { label: "สถานะ", value: "รอการยืนยันจากผู้ดูแลระบบ" }
        ]
      })
    );
  }
}

export async function notifyUserApprovalResult(userId: string, approved: boolean) {
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u) return;

  const subject = approved ? "บัญชีของคุณได้รับการยืนยันแล้ว" : "บัญชีของคุณถูกปฏิเสธ";
  const inAppBody = approved ? "คุณสามารถเข้าใช้งานระบบได้แล้ว" : "กรุณาติดต่อผู้ดูแลระบบสำหรับข้อมูลเพิ่มเติม";

  await record({ userId, subject, body: inAppBody, linkUrl: approved ? `${baseUrl()}/app` : baseUrl() });

  if (u.email) {
    await queueEmail(
      prisma,
      u.email,
      subject,
      approved
        ? buildUserEmail({
            title: "บัญชีของคุณพร้อมใช้งาน",
            bodyLines: [
              `สวัสดีคุณ <strong>${u.fullName}</strong>`,
              "บัญชีของคุณได้รับการยืนยันเรียบร้อยแล้ว",
              "คุณสามารถเข้าสู่ระบบและเริ่มใช้งานได้ทันที"
            ],
            ctaText: "เข้าสู่ระบบ",
            ctaUrl: `${baseUrl()}/auth/login`
          })
        : buildUserEmail({
            title: "บัญชีของคุณถูกปฏิเสธ",
            bodyLines: [
              `สวัสดีคุณ <strong>${u.fullName}</strong>`,
              "ขออภัย บัญชีของคุณไม่ได้รับการอนุมัติในครั้งนี้",
              "กรุณาติดต่อผู้ดูแลระบบสำหรับข้อมูลเพิ่มเติม"
            ]
          })
    );
  }
}
