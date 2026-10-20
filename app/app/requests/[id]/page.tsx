"use client";

import { startTransition, useCallback, useEffect, useState, use } from "react";
import { twMerge } from "tailwind-merge";
import { ConfirmDialog } from "@/app/_components/dialogs";
import { LiffTopBar, StatusPill, TYPE_LABEL, CONDITION_LABEL } from "../../_shared";
import { Skeleton } from "@/app/_components/ui";
import { ImageViewer, useAttachmentUrls } from "@/app/_components/image-viewer";

interface ApprovalRecord {
  id: string;
  step: number;
  stepName: string | null;
  decision: string;
  comment: string | null;
  decidedAt: string;
  approver: { fullName: string };
}

interface Revision {
  id: string;
  reason: string;
  createdAt: string;
  editedBy: { fullName: string };
}

interface ReqDetail {
  id: string;
  docNo: string;
  type: string;
  status: string;
  requesterId: string;
  createdAt: string;
  neededDate: string | null;
  purpose: string | null;
  note: string | null;
  condition: string | null;
  stepSnapshot: Array<{ stepOrder: number; name: string }> | null;
  currentStepOrder: number | null;
  requester: { fullName: string };
  fromDepartment: { name: string } | null;
  fromSection: { name: string } | null;
  toDepartment: { name: string } | null;
  toSection: { name: string } | null;
  items: { id: string; palletType: { name: string }; quantity: number }[];
  approvals: ApprovalRecord[];
  attachments: { id: string; filePath: string }[];
  revisions: Revision[];
  warnings: string[];
}

interface Me {
  authenticated: boolean;
  user?: { id: string; roles: string[] };
}

type TypeTheme = {
  gradient: string;
  itemBg: string;
  currentDot: string;
  currentRing: string;
  currentBadge: string;
  currentText: string;
};

const TYPE_THEME: Record<string, TypeTheme> = {
  ISSUE: {
    gradient: "from-orange-500 to-orange-700",
    itemBg: "bg-orange-50",
    currentDot: "bg-orange-500",
    currentRing: "ring-orange-100",
    currentBadge: "bg-orange-100 text-orange-700",
    currentText: "text-orange-700"
  },
  RETURN: {
    gradient: "from-blue-500 to-blue-700",
    itemBg: "bg-blue-50",
    currentDot: "bg-blue-500",
    currentRing: "ring-blue-100",
    currentBadge: "bg-blue-100 text-blue-700",
    currentText: "text-blue-700"
  }
};

const DEFAULT_THEME: TypeTheme = {
  gradient: "from-slate-600 to-slate-800",
  itemBg: "bg-slate-50",
  currentDot: "bg-slate-400",
  currentRing: "ring-slate-100",
  currentBadge: "bg-slate-100 text-slate-600",
  currentText: "text-slate-600"
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [r, setR] = useState<ReqDetail | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/requests/${id}`);
    if (res.ok) {
      const data = await res.json();
      startTransition(() => setR(data));
    }
  }, [id]);

  useEffect(() => {
    void load();
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => startTransition(() => setMe(d)));
  }, [load]);

  async function cancel() {
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/requests/${id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      setErr((await res.json().catch(() => ({}))).error ?? "ยกเลิกไม่สำเร็จ");
      return;
    }
    load();
  }

  if (!r) {
    return (
      <div>
        <LiffTopBar title="คำขอ" />
        <div className="space-y-3 p-4">
          <Skeleton className="h-36 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  const isRequester = me?.user?.id === r.requesterId;
  const isPending = ["PENDING_DEPT", "PENDING_WAREHOUSE"].includes(r.status);
  const canCancel = isRequester && isPending && r.approvals.length === 0;
  const theme = TYPE_THEME[r.type] ?? DEFAULT_THEME;
  const fromLabel = r.fromDepartment ? `${r.fromDepartment.name}${r.fromSection ? ` · ${r.fromSection.name}` : ""}` : "-";
  const toLabel = r.toDepartment ? `${r.toDepartment.name}${r.toSection ? ` · ${r.toSection.name}` : ""}` : "-";

  return (
    <div>
      <LiffTopBar title={r.docNo} />
      <div className="space-y-3 p-4 pb-32">
        {/* Warnings */}
        {isPending && r.warnings.length > 0 && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3.5">
            <p className="text-xs font-semibold text-amber-900">⚠ ข้อควรทราบ</p>
            <ul className="mt-1 space-y-0.5">
              {r.warnings.map((w, i) => (
                <li key={i} className="text-xs text-amber-800">
                  • {w}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Header */}
        <div className={`overflow-hidden rounded-2xl bg-linear-to-br ${theme.gradient} p-5`}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-white/25 px-2.5 py-0.5 text-[11px] font-bold text-white">{TYPE_LABEL[r.type] ?? r.type}</span>
              {r.condition && r.condition !== "GOOD" && (
                <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-medium text-white/90">
                  {CONDITION_LABEL[r.condition] ?? r.condition}
                </span>
              )}
            </div>
            <StatusPill status={r.status} />
          </div>
          <p className="mt-2.5 text-xl font-bold text-white">{r.docNo}</p>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-white/70">
            <span>{fromLabel}</span>
            <span className="text-white/40">→</span>
            <span>{toLabel}</span>
          </div>
          <p className="mt-1 text-[11px] text-white/50">{fmtDate(r.createdAt)}</p>
        </div>

        {/* Info rows */}
        <div className="overflow-hidden rounded-2xl border border-border bg-white">
          <div className="divide-y divide-slate-100">
            <InfoRow label="ผู้ร้องขอ" value={r.requester.fullName} />
            {r.neededDate && <InfoRow label="วันที่ต้องการ" value={fmtDate(r.neededDate)} />}
            {r.purpose && <InfoRow label="วัตถุประสงค์" value={r.purpose} multiline />}
            {r.note && <InfoRow label="หมายเหตุ" value={r.note} multiline />}
          </div>
        </div>

        {/* Items */}
        <div className="rounded-2xl border border-border bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900">รายการ</p>
            {r.condition && (
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                สภาพ: {CONDITION_LABEL[r.condition] ?? r.condition}
              </span>
            )}
          </div>
          <ul className="mt-3 space-y-1.5">
            {r.items.map((it) => (
              <li key={it.id} className={twMerge("flex items-center justify-between rounded-lg px-3 py-2.5", theme.itemBg)}>
                <span className="text-sm font-medium text-slate-800">{it.palletType.name}</span>
                <span className="font-mono text-sm font-semibold text-slate-900">× {it.quantity}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Approval timeline */}
        <ApprovalTimeline r={r} theme={theme} fmtTime={fmtTime} />

        {/* Revisions */}
        {r.revisions.length > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-semibold text-amber-900">แก้ไขโดยคลัง</p>
            <ul className="mt-2 space-y-2">
              {r.revisions.map((rev) => (
                <li key={rev.id} className="rounded-xl bg-white p-3 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-800">{rev.editedBy.fullName}</span>
                    <span className="shrink-0 text-[11px] text-slate-400">{fmtDate(rev.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">{rev.reason}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Attachments */}
        {r.attachments.length > 0 && <AttachmentsBlock attachments={r.attachments} onOpen={(i) => setPreviewIndex(i)} />}

        {err && <p className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{err}</p>}
      </div>

      {showCancelConfirm && (
        <ConfirmDialog
          message="ยืนยันยกเลิกคำขอนี้?"
          confirmLabel="ยกเลิกคำขอ"
          danger
          onConfirm={() => {
            setShowCancelConfirm(false);
            cancel();
          }}
          onCancel={() => setShowCancelConfirm(false)}
        />
      )}

      {canCancel && (
        <div className="fixed bottom-0 left-1/2 z-20 w-full max-w-md -translate-x-1/2 border-t border-border bg-white p-4">
          <button
            onClick={() => setShowCancelConfirm(true)}
            disabled={busy}
            className="h-12 w-full rounded-xl border border-rose-200 bg-white text-sm font-semibold text-rose-700 disabled:opacity-50"
          >
            ยกเลิกคำขอ
          </button>
        </div>
      )}

      {previewIndex !== null && r.attachments.length > 0 && (
        <AttachmentViewer attachments={r.attachments} startIndex={previewIndex} onClose={() => setPreviewIndex(null)} />
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function InfoRow({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div className={twMerge("flex gap-4 px-4 py-3", multiline ? "flex-col" : "items-center justify-between")}>
      <span className="shrink-0 text-xs text-slate-500">{label}</span>
      <span className={twMerge("text-xs font-medium text-slate-800", !multiline && "text-right")}>{value}</span>
    </div>
  );
}

type StepState = "done" | "rejected" | "current" | "waiting";

function ApprovalTimeline({ r, theme, fmtTime }: { r: ReqDetail; theme: TypeTheme; fmtTime: (s: string) => string }) {
  const snapshot = r.stepSnapshot as Array<{ stepOrder: number; name: string }> | null;
  const byStep = new Map(r.approvals.map((a) => [a.step, a]));
  const allDone = r.status === "COMPLETED";
  const atWarehouse = r.status === "PENDING_WAREHOUSE";
  const isCancelled = r.status === "CANCELLED";

  if (!snapshot || snapshot.length === 0) {
    if (r.approvals.length === 0) return null;
    return (
      <div className="rounded-2xl border border-border bg-white p-4">
        <p className="mb-3 text-sm font-semibold text-slate-900">การอนุมัติ</p>
        <ul className="space-y-2">
          {r.approvals.map((a) => (
            <li key={a.id} className="rounded-xl bg-slate-50 p-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className={a.decision === "APPROVED" ? "font-semibold text-emerald-700" : "font-semibold text-rose-700"}>
                  {a.decision === "APPROVED" ? "✓ อนุมัติ" : "✗ ปฏิเสธ"}
                </span>
                <span className="shrink-0 text-[11px] text-slate-400">{fmtTime(a.decidedAt)}</span>
              </div>
              <p className="mt-0.5 text-slate-600">โดย {a.approver.fullName}</p>
              {a.comment && <p className="mt-1 text-slate-400 italic">&quote;{a.comment}&quote;</p>}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const steps = [
    ...snapshot.map((s) => ({ stepOrder: s.stepOrder, name: s.name, isWarehouse: false })),
    { stepOrder: snapshot.length + 1, name: "คลังพาเลท", isWarehouse: true }
  ];

  return (
    <div className="rounded-2xl border border-border bg-white p-4">
      <p className="mb-4 text-sm font-semibold text-slate-900">ขั้นตอนการอนุมัติ</p>
      {steps.map((step, idx) => {
        const approval = byStep.get(step.stepOrder);
        const isLast = idx === steps.length - 1;

        let state: StepState = "waiting";
        if (step.isWarehouse) {
          if (allDone) state = "done";
          else if (atWarehouse) state = "current";
          else if (byStep.get(step.stepOrder)?.decision === "REJECTED") state = "rejected";
        } else {
          if (approval?.decision === "APPROVED" || approval?.decision === "EDIT_APPROVED") state = "done";
          else if (approval?.decision === "REJECTED") state = "rejected";
          else if (r.currentStepOrder === step.stepOrder && !isCancelled) state = "current";
        }

        const iconRing: Record<StepState, string> = {
          done: "bg-emerald-500 text-white",
          rejected: "bg-rose-500 text-white",
          current: `${theme.currentDot} text-white ring-4 ${theme.currentRing}`,
          waiting: "bg-slate-200 text-slate-400"
        };
        const nameColor: Record<StepState, string> = {
          done: "text-slate-800",
          rejected: "text-rose-700",
          current: theme.currentText,
          waiting: "text-slate-400"
        };
        const lineColor = state === "done" ? "bg-emerald-200" : "bg-slate-100";

        const iconLabel = state === "done" ? "✓" : state === "rejected" ? "✗" : String(step.stepOrder);

        return (
          <div key={step.stepOrder} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={twMerge("grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold", iconRing[state])}>
                {iconLabel}
              </div>
              {!isLast && <div className={twMerge("my-1 w-0.5 flex-1", lineColor)} style={{ minHeight: 14 }} />}
            </div>

            <div className={twMerge("min-w-0 flex-1", !isLast && "pb-4")}>
              <div className="flex items-center gap-1.5">
                <p className={twMerge("text-xs font-semibold", nameColor[state])}>{step.name}</p>
                {state === "current" && (
                  <span className={twMerge("rounded-full px-1.5 py-0.5 text-[10px] font-medium", theme.currentBadge)}>รออนุมัติ</span>
                )}
              </div>
              {approval && (
                <div className="mt-0.5">
                  <p className="text-[11px] text-slate-500">
                    {approval.approver.fullName} · {fmtTime(approval.decidedAt)}
                  </p>
                  {approval.comment && <p className="mt-0.5 text-[11px] italic text-slate-400">&quote;{approval.comment}&quote;</p>}
                </div>
              )}
              {isCancelled && state === "waiting" && <p className="mt-0.5 text-[11px] text-slate-400">ยกเลิกแล้ว</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AttachmentsBlock({ attachments, onOpen }: { attachments: { id: string; filePath: string }[]; onOpen: (index: number) => void }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-900">รูปแนบ ({attachments.length})</p>
        <button
          type="button"
          onClick={() => onOpen(0)}
          className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
        >
          ดูทั้งหมด
        </button>
      </div>
      <AttachmentThumbs attachments={attachments} onOpen={onOpen} />
    </div>
  );
}

function AttachmentThumbs({ attachments, onOpen }: { attachments: { id: string; filePath: string }[]; onOpen: (index: number) => void }) {
  const urls = useAttachmentUrls(attachments.map((a) => a.id));
  return (
    <ul className="mt-3 grid grid-cols-3 gap-2">
      {attachments.map((a, i) => (
        <li key={a.id} className="aspect-square overflow-hidden rounded-xl bg-slate-100">
          {urls[a.id] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={urls[a.id]}
              alt={a.filePath.split("/").pop() ?? ""}
              onClick={() => onOpen(i)}
              className="h-full w-full cursor-zoom-in object-cover"
            />
          ) : (
            <div className="h-full w-full animate-pulse bg-slate-200" />
          )}
        </li>
      ))}
    </ul>
  );
}

function AttachmentViewer({
  attachments,
  startIndex,
  onClose
}: {
  attachments: { id: string; filePath: string }[];
  startIndex: number;
  onClose: () => void;
}) {
  const urls = useAttachmentUrls(attachments.map((a) => a.id));
  const images = attachments.map((a) => ({ src: urls[a.id], name: a.filePath.split("/").pop() })).filter((img) => img.src);
  if (images.length === 0) return null;
  return <ImageViewer images={images} startIndex={startIndex} onClose={onClose} />;
}
