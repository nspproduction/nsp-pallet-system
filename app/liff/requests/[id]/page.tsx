"use client";

// Library
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";

// Components
import { LiffTopBar, StatusPill, TYPE_LABEL } from "../../_shared";
import { Skeleton } from "@/app/_components/ui";

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
  requester: { fullName: string };
  fromDepartment: { name: string } | null;
  fromSection: { name: string } | null;
  toDepartment: { name: string } | null;
  toSection: { name: string } | null;
  items: { id: string; palletType: { name: string }; condition: string; quantity: number; actualQuantity: number | null }[];
  approvals: { id: string; decision: string; comment: string | null; decidedAt: string; approver: { fullName: string } }[];
  attachments: { id: string; filePath: string }[];
}

interface Me { authenticated: boolean; user?: { id: string; role: string } }

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [r, setR] = useState<ReqDetail | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    load();
    fetch("/api/auth/me").then((r) => r.json()).then(setMe);
  }, [id]);

  async function load() {
    const res = await fetch(`/api/requests/${id}`);
    if (res.ok) setR(await res.json());
  }

  async function cancel() {
    if (!confirm("ยืนยันยกเลิกคำขอ?")) return;
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/requests/${id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErr(data.error ?? "ยกเลิกไม่สำเร็จ");
      return;
    }
    load();
  }

  async function uploadFile(file: File) {
    setBusy(true);
    setErr(null);
    try {
      const urlRes = await fetch("/api/attachments/upload-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId: id, filename: file.name }),
      });
      if (!urlRes.ok) throw new Error("get upload url failed");
      const { path, signedUrl } = await urlRes.json();

      const putRes = await fetch(signedUrl, { method: "PUT", body: file, headers: { "content-type": file.type } });
      if (!putRes.ok) throw new Error("upload failed");

      await fetch("/api/attachments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId: id, path, fileType: file.type, fileSize: file.size }),
      });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  if (!r) {
    return (
      <div>
        <LiffTopBar title="คำขอ" backHref="/liff/requests" />
        <div className="space-y-4 p-4">
          <div className="space-y-3 rounded-2xl border border-border bg-white p-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-4 w-16 rounded-full" />
            </div>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="space-y-2 rounded-2xl border border-border bg-white p-4">
            <Skeleton className="h-3 w-20" />
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  const isRequester = me?.user?.id === r.requesterId;
  const canCancel = isRequester && r.status === "PENDING";

  return (
    <div>
      <LiffTopBar title={r.docNo} backHref="/liff/requests" />
      <div className="space-y-4 p-4 pb-32">
        <div className="flex items-center justify-between rounded-2xl bg-gradient-to-br from-brand-600 to-brand-900 p-4 text-white">
          <div>
            <p className="text-xs uppercase tracking-widest text-white/70">{TYPE_LABEL[r.type] ?? r.type}</p>
            <p className="mt-1 text-lg font-semibold">{r.docNo}</p>
          </div>
          <StatusPill status={r.status} />
        </div>

        <div className="rounded-2xl border border-border bg-white p-4">
          <p className="text-xs text-slate-500">ผู้ร้องขอ</p>
          <p className="text-sm font-medium text-slate-900">{r.requester.fullName}</p>
          <p className="mt-3 text-xs text-slate-500">เส้นทาง</p>
          <p className="text-sm text-slate-900">
            {r.fromDepartment
              ? `${r.fromDepartment.name}${r.fromSection ? ` · ${r.fromSection.name}` : ""}`
              : "-"}
            {" → "}
            {r.toDepartment
              ? `${r.toDepartment.name}${r.toSection ? ` · ${r.toSection.name}` : ""}`
              : "-"}
          </p>
          {r.neededDate && (
            <>
              <p className="mt-3 text-xs text-slate-500">วันที่ต้องการ</p>
              <p className="text-sm text-slate-900">{new Date(r.neededDate).toLocaleDateString("th-TH")}</p>
            </>
          )}
          {r.purpose && (
            <>
              <p className="mt-3 text-xs text-slate-500">วัตถุประสงค์</p>
              <p className="text-sm text-slate-900">{r.purpose}</p>
            </>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">รายการพาเลท</p>
          <ul className="mt-3 divide-y divide-slate-100">
            {r.items.map((it) => (
              <li key={it.id} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-slate-800">{it.palletType.name}</p>
                  <p className="text-[11px] text-slate-500">{it.condition}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm text-slate-900">
                    {it.actualQuantity ?? it.quantity}
                    {it.actualQuantity !== null && it.actualQuantity !== it.quantity && (
                      <span className="ml-1 text-xs text-amber-700">(ขอ {it.quantity})</span>
                    )}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {r.approvals.length > 0 && (
          <div className="rounded-2xl border border-border bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">การอนุมัติ</p>
            <ul className="mt-3 space-y-2">
              {r.approvals.map((a) => (
                <li key={a.id} className="rounded-lg bg-slate-50 p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className={a.decision === "APPROVED" ? "font-semibold text-emerald-700" : "font-semibold text-rose-700"}>
                      {a.decision === "APPROVED" ? "✓ อนุมัติ" : "✗ ปฏิเสธ"}
                    </span>
                    <span className="text-slate-400">{new Date(a.decidedAt).toLocaleString("th-TH")}</span>
                  </div>
                  <p className="mt-1 text-slate-700">โดย {a.approver.fullName}</p>
                  {a.comment && <p className="mt-1 text-slate-600">"{a.comment}"</p>}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="rounded-2xl border border-border bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900">รูปแนบ ({r.attachments.length})</p>
            <label className="cursor-pointer rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              + แนบไฟล์
              <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])} />
            </label>
          </div>
          {r.attachments.length > 0 && (
            <ul className="mt-3 space-y-1">
              {r.attachments.map((a) => (
                <li key={a.id} className="truncate rounded bg-slate-50 px-2 py-1 text-xs font-mono text-slate-600">
                  {a.filePath.split("/").pop()}
                </li>
              ))}
            </ul>
          )}
        </div>

        {err && <p className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{err}</p>}
      </div>

      {canCancel && (
        <div className="fixed bottom-0 left-1/2 z-20 w-full max-w-md -translate-x-1/2 border-t border-border bg-white p-4">
          <button
            onClick={cancel}
            disabled={busy}
            className="h-12 w-full rounded-xl border border-rose-200 bg-white text-sm font-semibold text-rose-700 disabled:opacity-50"
          >
            ยกเลิกคำขอ
          </button>
        </div>
      )}
    </div>
  );
}
