import { prisma } from "@/lib/prisma";

// Queue an email for asynchronous delivery.
// Call this INSIDE a DB transaction so email and business action are atomic.
export async function queueEmail(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0] | typeof prisma,
  to: string,
  subject: string,
  bodyHtml: string,
) {
  await (tx as typeof prisma).emailOutbox.create({
    data: { to, subject, bodyHtml },
  });
}

const FONT = `'Noto Sans Thai', 'Sarabun', Arial, sans-serif`;

const BASE_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0; background: #f1f5f9; }
`;

function emailShell(title: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${title}</title>
  <style>${BASE_STYLES}</style>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:${FONT}">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f1f5f9;padding:40px 16px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:580px">

        <!-- Logo -->
        <tr><td style="padding-bottom:20px">
          <table cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td style="background:#4f46e5;border-radius:10px;width:38px;height:38px;text-align:center;vertical-align:middle">
                <span style="color:#fff;font-size:16px;font-weight:700;line-height:38px;font-family:${FONT}">N</span>
              </td>
              <td style="padding-left:10px;vertical-align:middle">
                <p style="margin:0;font-size:12px;font-weight:700;color:#4f46e5;letter-spacing:0.12em;font-family:${FONT}">NORITAKE</p>
                <p style="margin:0;font-size:11px;color:#94a3b8;font-family:${FONT}">ระบบเบิก/คืนพาเลท</p>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Card -->
        <tr><td style="background:#ffffff;border-radius:16px;box-shadow:0 4px 16px rgba(0,0,0,0.08);overflow:hidden">
          ${content}
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding-top:20px;text-align:center">
          <p style="margin:0;font-size:11px;color:#94a3b8;font-family:${FONT}">
            อีเมลนี้ส่งโดยอัตโนมัติ กรุณาอย่าตอบกลับ &nbsp;·&nbsp; Noritake Pallet Management
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function buildUserEmail(opts: {
  title: string;
  bodyLines: string[];
  summaryRows?: Array<{ label: string; value: string }>;
  ctaText?: string;
  ctaUrl?: string;
}): string {
  const lines = opts.bodyLines
    .map((l) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.7;color:#1e293b;font-family:${FONT}">${l}</p>`)
    .join("");

  const summaryTable = opts.summaryRows?.length
    ? `<table width="100%" cellpadding="0" cellspacing="0" role="presentation"
             style="margin:20px 0;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;border-collapse:separate;border-spacing:0">
        ${opts.summaryRows.map((r, i) => `
          <tr style="background:${i % 2 === 0 ? "#ffffff" : "#f8fafc"}">
            <td style="padding:10px 16px;font-size:13px;color:#64748b;font-family:${FONT};width:110px;white-space:nowrap">${r.label}</td>
            <td style="padding:10px 16px;font-size:13px;color:#1e293b;font-weight:500;font-family:${FONT}">${r.value}</td>
          </tr>`).join("")}
      </table>`
    : "";

  const cta = opts.ctaText && opts.ctaUrl
    ? `<table cellpadding="0" cellspacing="0" role="presentation" style="margin-top:28px">
        <tr>
          <td style="background:#4f46e5;border-radius:10px">
            <a href="${opts.ctaUrl}"
               style="display:inline-block;padding:13px 28px;color:#fff;font-size:14px;font-weight:600;text-decoration:none;font-family:${FONT}">
              ${opts.ctaText} &rarr;
            </a>
          </td>
        </tr>
      </table>`
    : "";

  const content = `
    <!-- Header -->
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <td style="background:#4f46e5;padding:28px 32px">
          <p style="margin:0;color:#fff;font-size:20px;font-weight:700;font-family:${FONT}">${opts.title}</p>
        </td>
      </tr>
    </table>
    <!-- Body -->
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <td style="padding:32px">
          ${lines}
          ${summaryTable}
          ${cta}
        </td>
      </tr>
    </table>
    <!-- Divider -->
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <td style="padding:0 32px 20px">
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:0">
          <p style="margin:12px 0 0;font-size:11px;color:#cbd5e1;font-family:${FONT}">
            หากคุณไม่ได้ดำเนินการนี้ กรุณาติดต่อผู้ดูแลระบบ
          </p>
        </td>
      </tr>
    </table>`;

  return emailShell(opts.title, content);
}

function statusBadge(statusText: string): { bg: string; color: string; border: string } {
  if (statusText.includes("ปฏิเสธ"))  return { bg: "#fef2f2", color: "#dc2626", border: "#fecaca" };
  if (statusText.includes("อนุมัติ")) return { bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" };
  return { bg: "#fffbeb", color: "#d97706", border: "#fde68a" };
}

export function buildRequestEmail(opts: {
  title: string;
  docNo: string;
  typeLabel: string;
  requesterName: string;
  departmentName: string;
  itemsSummary: string;
  statusText: string;
  comment?: string;
  appUrl: string;
  requestId: string;
}): string {
  const link = `${opts.appUrl}/app/requests/${opts.requestId}`;
  const badge = statusBadge(opts.statusText);

  const rows: Array<{ label: string; value: string }> = [
    { label: "ประเภท",   value: opts.typeLabel },
    { label: "ผู้ร้องขอ", value: opts.requesterName },
    { label: "แผนก",     value: opts.departmentName },
    { label: "รายการ",   value: opts.itemsSummary },
    ...(opts.comment ? [{ label: "หมายเหตุ", value: opts.comment }] : []),
  ];

  const tableRows = rows
    .map((r, i) => `
      <tr style="background:${i % 2 === 0 ? "#ffffff" : "#f8fafc"}">
        <td style="padding:10px 16px;font-size:13px;color:#64748b;font-family:${FONT};width:100px;white-space:nowrap">${r.label}</td>
        <td style="padding:10px 16px;font-size:13px;color:#1e293b;font-family:${FONT}">${r.value}</td>
      </tr>`)
    .join("");

  const content = `
    <!-- Header -->
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <td style="background:#4f46e5;padding:28px 32px">
          <p style="margin:0;color:#fff;font-size:20px;font-weight:700;font-family:${FONT}">${opts.title}</p>
          <p style="margin:6px 0 0;color:#c7d2fe;font-size:13px;font-family:${FONT}">เลขที่เอกสาร: ${opts.docNo}</p>
        </td>
      </tr>
    </table>

    <!-- Status badge -->
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <td style="padding:24px 32px 8px">
          <table cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td style="background:${badge.bg};border:1px solid ${badge.border};border-radius:8px;padding:8px 16px">
                <p style="margin:0;font-size:13px;font-weight:600;color:${badge.color};font-family:${FONT}">สถานะ: ${opts.statusText}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Info table -->
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
           style="margin:16px 0;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;border-collapse:separate;border-spacing:0;margin:16px 32px;width:calc(100% - 64px)">
      ${tableRows}
    </table>

    <!-- CTA -->
    <table cellpadding="0" cellspacing="0" role="presentation" style="margin:24px 32px 32px">
      <tr>
        <td style="background:#4f46e5;border-radius:10px">
          <a href="${link}"
             style="display:inline-block;padding:13px 28px;color:#fff;font-size:14px;font-weight:600;text-decoration:none;font-family:${FONT}">
            ดูรายละเอียดคำขอ &rarr;
          </a>
        </td>
      </tr>
    </table>

    <!-- Divider -->
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <td style="padding:0 32px 20px">
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:0">
          <p style="margin:12px 0 0;font-size:11px;color:#cbd5e1;font-family:${FONT}">
            หากคุณไม่ได้เป็นผู้เกี่ยวข้องกับคำขอนี้ กรุณาละเว้นอีเมลฉบับนี้
          </p>
        </td>
      </tr>
    </table>`;

  return emailShell(opts.title, content);
}
