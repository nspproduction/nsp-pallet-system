import { requireUser } from "@/lib/auth/current-user";
import { getRequestDetail } from "@/lib/services/request";
import { notFound } from "next/navigation";
import { PageHeader, Card, StatusBadge } from "@/app/_components/ui";
import { RequestActions } from "./actions";

export const dynamic = "force-dynamic";

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

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const r = await getRequestDetail(id);
  if (!r) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={r.docNo}
        subtitle={`${TYPE_LABEL[r.type] ?? r.type} · โดย ${r.requester.fullName}`}
        actions={<StatusBadge status={r.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <h3 className="text-base font-semibold text-slate-900">ข้อมูลคำขอ</h3>
            <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <Row label="ประเภท" value={TYPE_LABEL[r.type] ?? r.type} />
              <Row label="สถานะ" value={<StatusBadge status={r.status} />} />
              <Row
                label="จาก"
                value={
                  r.fromDepartment
                    ? `${r.fromDepartment.name}${r.fromSection ? ` · ${r.fromSection.name}` : ""}`
                    : "-"
                }
              />
              <Row
                label="ไป"
                value={
                  r.toDepartment
                    ? `${r.toDepartment.name}${r.toSection ? ` · ${r.toSection.name}` : ""}`
                    : "-"
                }
              />
              <Row label="วันที่ต้องการ" value={r.neededDate ? r.neededDate.toLocaleDateString("th-TH") : "-"} />
              <Row label="วัตถุประสงค์" value={r.purpose ?? "-"} full />
              <Row label="หมายเหตุ" value={r.note ?? "-"} full />
            </dl>
          </Card>

          <Card>
            <h3 className="text-base font-semibold text-slate-900">รายการพาเลท</h3>
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-semibold uppercase text-slate-500">
                  <th className="pb-2">ชนิด</th>
                  <th>สถานะ</th>
                  <th className="text-right">ขอ</th>
                  <th className="text-right">จริง</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {r.items.map((it) => (
                  <tr key={it.id}>
                    <td className="py-2 font-medium text-slate-900">{it.palletType.name}</td>
                    <td className="py-2 text-xs text-slate-500">{it.condition}</td>
                    <td className="py-2 text-right font-mono text-slate-700">{it.quantity}</td>
                    <td className="py-2 text-right font-mono">
                      {it.actualQuantity !== null ? (
                        <span className={it.actualQuantity === it.quantity ? "text-emerald-700" : "text-amber-700"}>
                          {it.actualQuantity}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card>
            <h3 className="text-base font-semibold text-slate-900">Timeline</h3>
            <ul className="mt-4 space-y-3 text-sm">
              <TL when={r.createdAt} label="สร้างคำขอ" by={r.requester.fullName} />
              {r.approvals.map((a) => (
                <TL
                  key={a.id}
                  when={a.decidedAt}
                  label={a.decision === "APPROVED" ? "อนุมัติ" : "ปฏิเสธ"}
                  by={a.approver.fullName}
                  comment={a.comment ?? undefined}
                />
              ))}
              {r.storeActions.map((s) => (
                <TL
                  key={s.id}
                  when={s.actedAt}
                  label={s.action === "CONFIRM_DISPATCH" ? "ยืนยันจ่ายของ" : "ยืนยันรับของ"}
                  by={s.user.fullName}
                  comment={s.comment ?? undefined}
                />
              ))}
              {r.cancelledAt && <TL when={r.cancelledAt} label="ยกเลิก" by={r.requester.fullName} />}
            </ul>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h3 className="text-base font-semibold text-slate-900">การดำเนินการ</h3>
            <div className="mt-4">
              <RequestActions
                requestId={r.id}
                status={r.status}
                requesterId={r.requesterId}
                items={r.items.map((it) => ({ id: it.id, palletType: it.palletType.name, condition: it.condition, quantity: it.quantity }))}
                currentUser={{ id: user.id, role: user.role }}
              />
            </div>
          </Card>

          {r.attachments.length > 0 && (
            <Card>
              <h3 className="text-base font-semibold text-slate-900">ไฟล์แนบ</h3>
              <ul className="mt-3 space-y-2 text-sm">
                {r.attachments.map((a) => (
                  <li key={a.id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 font-mono truncate">
                    {a.filePath.split("/").pop()}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, full }: { label: string; value: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{value}</dd>
    </div>
  );
}

function TL({ when, label, by, comment }: { when: Date; label: string; by: string; comment?: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" />
      <div>
        <p className="font-medium text-slate-800">{label} <span className="font-normal text-slate-500">โดย {by}</span></p>
        <p className="text-[11px] text-slate-400">{when.toLocaleString("th-TH")}</p>
        {comment && <p className="mt-1 rounded bg-slate-50 px-2 py-1 text-xs text-slate-600">{comment}</p>}
      </div>
    </li>
  );
}
