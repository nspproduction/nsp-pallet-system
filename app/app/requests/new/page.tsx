"use client";

// Library
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { twMerge } from "tailwind-merge";

// Components
import { LiffTopBar } from "../../_shared";
import { Skeleton } from "@/app/_components/ui";

// Lib
import { safeFetchJson } from "../../_fetch";

// Types & constants
import { Mode, Condition, Item, BalanceRow, OperatingStatus, MeResponse, PalletType, PALETTE, MyRouteResponse, RouteStep, ReturnSource } from "./_types";

// Sub-components
import { ModeTabs } from "./_ModeTabs";
import { RequesterBanner } from "./_RequesterBanner";
import { ConditionPicker } from "./_ConditionPicker";
import { ItemsSection } from "./_ItemsSection";
import { AttachmentPicker } from "./_AttachmentPicker";
import { MetaFields } from "./_MetaFields";
import { ApproverPicker } from "./_ApproverPicker";
import { ReturnSourcePicker } from "./_ReturnSourcePicker";

/** Set to true to re-enable file attachments on the request form */
const ATTACHMENT_ENABLED = false;

export default function Page() {
  const router = useRouter();
  const [palletTypes, setPalletTypes] = useState<PalletType[]>([]);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [warehouseBalance, setWarehouseBalance] = useState<Record<string, number>>({});

  const [mode, setMode] = useState<Mode>("ISSUE_OUT");
  const [returnCondition, setReturnCondition] = useState<Condition>("GOOD");
  const [neededDate, setNeededDate] = useState(() => new Date().toLocaleDateString("sv-SE"));
  const [purpose, setPurpose] = useState("");
  const [items, setItems] = useState<Item[]>([{ palletTypeId: "", quantity: 1 }]);
  const [files, setFiles] = useState<File[]>([]);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [submitWarnings, setSubmitWarnings] = useState<string[]>([]);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [opStatus, setOpStatus] = useState<OperatingStatus | null>(null);
  const [routeSteps, setRouteSteps] = useState<RouteStep[]>([]);
  const [approverPicks, setApproverPicks] = useState<Record<number, string>>({});
  const [returnSource, setReturnSource] = useState<ReturnSource | null>(null);

  useEffect(() => {
    void (async () => {
      const [pt, meRes, bal, opRes] = await Promise.all([
        safeFetchJson<PalletType[]>("/api/pallet-types"),
        safeFetchJson<MeResponse>("/api/auth/me"),
        safeFetchJson<BalanceRow[]>("/api/balances?deductPending=1"),
        safeFetchJson<OperatingStatus>("/api/operating-hours?check=1")
      ]);
      if (pt.error) setErr(pt.error);
      setPalletTypes(Array.isArray(pt.data) ? pt.data : []);
      if (meRes.data) setMe(meRes.data);
      if (opRes.data) setOpStatus(opRes.data);
      if (Array.isArray(bal.data)) {
        const map: Record<string, number> = {};
        for (const row of bal.data) {
          if (!row.department?.isWarehouse) continue;
          map[`${row.palletTypeId}::${row.condition}`] = (map[`${row.palletTypeId}::${row.condition}`] ?? 0) + row.quantity;
        }
        setWarehouseBalance(map);
      }
      setLoading(false);
    })();
  }, []);

  // Fetch route for the current mode so we know which steps require a pick.
  // Also prefill picks for steps that have a single candidate (auto-select).
  useEffect(() => {
    const type = mode === "ISSUE_OUT" ? "ISSUE" : "RETURN";
    void (async () => {
      const r = await safeFetchJson<MyRouteResponse>(`/api/approval-routes/mine?type=${type}`);
      const steps = r.data?.steps ?? [];
      setRouteSteps(steps);
      const prefill: Record<number, string> = {};
      for (const s of steps) {
        if (s.requesterPicks && s.approvers.length === 1) {
          prefill[s.stepOrder] = s.approvers[0].id;
        }
      }
      setApproverPicks(prefill);
    })();
  }, [mode]);

  const dept = me?.user?.department ?? null;
  const section = me?.user?.section ?? null;

  const availableModes: Mode[] = ["ISSUE_OUT", "RETURN_IN"];
  const palette = PALETTE[mode];

  function updateItem(index: number, patch: Partial<Item>) {
    setItems(items.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }
  function addItem() {
    setItems([...items, { palletTypeId: "", quantity: 1 }]);
  }
  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  async function submit() {
    setErr(null);
    setSubmitWarnings([]);
    if (!dept) {
      setErr("บัญชีของคุณยังไม่ได้ผูกกับแผนก กรุณาติดต่อ Admin");
      return;
    }
    const cleaned = items.filter((it) => it.palletTypeId && it.quantity > 0);
    if (cleaned.length === 0) {
      setErr("กรุณาเพิ่มรายการพาเลทอย่างน้อย 1 รายการ");
      return;
    }

    const type = mode === "ISSUE_OUT" ? "ISSUE" : "RETURN";
    const condition: Condition = mode === "RETURN_IN" ? returnCondition : "GOOD";
    const stepPicks = routeSteps
      .filter((s) => s.requesterPicks)
      .map((s) => ({ stepOrder: s.stepOrder, approverId: approverPicks[s.stepOrder] }))
      .filter((p) => Boolean(p.approverId));
    const payload = {
      type,
      condition,
      returnSource: type === "RETURN" ? returnSource : null,
      neededDate: neededDate || null,
      purpose: purpose || null,
      items: cleaned.map((it) => ({ palletTypeId: it.palletTypeId, quantity: it.quantity })),
      stepPicks
    };

    setBusy(true);
    setUploadStatus(null);
    const res = await fetch("/api/requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      setBusy(false);
      const data = await res.json().catch(() => ({}));
      setErr(data.message ?? data.error ?? "สร้างไม่สำเร็จ");
      return;
    }
    const created = await res.json();

    if (ATTACHMENT_ENABLED && files.length > 0) {
      setUploadStatus("กำลังอัปโหลดรูป...");
      const formData = new FormData();
      files.forEach((f) => formData.append("files", f));
      await fetch(`/api/requests/${created.id}/attachments`, { method: "POST", body: formData });
      setUploadStatus(null);
    }

    setBusy(false);

    const ws: string[] = Array.isArray(created.warnings) ? created.warnings : [];
    if (ws.length > 0) {
      setCreatedId(created.id);
      setSubmitWarnings(ws);
      return;
    }

    router.replace("/app/requests");
    router.push(`/app/requests/${created.id}`);
  }

  const roles = me?.user?.roles ?? [];
  const canCreate = roles.some((r: string) => ["REQUESTER", "ADMIN"].includes(r));

  const effectiveCondition: Condition = mode === "RETURN_IN" ? returnCondition : "GOOD";
  const deptMissing = !dept;
  const validItems = items.filter((it) => it.palletTypeId && it.quantity > 0);
  const hasPartialItem = items.some((it) => (!it.palletTypeId && it.quantity > 0) || (it.palletTypeId && it.quantity <= 0));
  const overBalance =
    mode === "ISSUE_OUT" &&
    validItems.some((it) => {
      const key = `${it.palletTypeId}::${effectiveCondition}`;
      return it.quantity > (warehouseBalance[key] ?? 0);
    });

  const missingPick = routeSteps.find(
    (s) => s.requesterPicks && s.approvers.length > 1 && !approverPicks[s.stepOrder]
  );
  const needsReturnSource = mode === "RETURN_IN" && Boolean(dept?.requiresReturnSource);
  const missingReturnSource = needsReturnSource && returnSource === null;

  const validationHint = deptMissing
    ? "บัญชีของคุณยังไม่ได้ผูกกับแผนก"
    : validItems.length === 0
      ? "กรุณาเพิ่มรายการพาเลทอย่างน้อย 1 รายการ"
      : hasPartialItem
        ? "กรุณากรอกชนิดพาเลทและจำนวนให้ครบทุกรายการ"
        : overBalance
          ? "มีรายการที่จำนวนเกินยอดคงเหลือในคลัง"
          : !neededDate
            ? "กรุณาเลือกวันที่ต้องการ"
            : missingPick
              ? `กรุณาเลือกผู้อนุมัติ: ขั้นที่ ${missingPick.stepOrder} ${missingPick.name}`
              : missingReturnSource
                ? "กรุณาเลือกที่มาของพาเลท (ใช้ภายใน / ลูกค้า)"
                : null;
  const canSubmit = !busy && validationHint === null;

  if (loading) {
    return (
      <div>
        <LiffTopBar title="สร้างคำขอ" />
        <div className="space-y-5 p-4 pb-32">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <div className="space-y-3 rounded-2xl border border-border bg-white p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-11 w-full rounded-lg" />
            <Skeleton className="h-11 w-full rounded-lg" />
          </div>
          <div className="space-y-3 rounded-2xl border border-border bg-white p-4">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-11 w-full rounded-lg" />
            <Skeleton className="h-11 w-full rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (me && !canCreate) {
    return (
      <div>
        <LiffTopBar title="สร้างคำขอ" />
        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-rose-100 text-2xl text-rose-500">🚫</div>
          <p className="mt-4 text-sm font-semibold text-slate-800">บทบาทของคุณไม่สามารถสร้างคำขอได้</p>
          <p className="mt-1 max-w-xs text-xs text-slate-500">เฉพาะผู้ขอเบิก (Requester) และ Admin เท่านั้นที่สร้างคำขอได้</p>
          <button
            onClick={() => router.push("/app")}
            className="mt-6 h-10 rounded-full bg-brand-600 px-6 text-sm font-medium text-white shadow-sm shadow-brand-600/30"
          >
            กลับหน้าหลัก
          </button>
        </div>
      </div>
    );
  }

  if (opStatus && !opStatus.isOpen) {
    return (
      <div>
        <LiffTopBar title="สร้างคำขอ" />
        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-amber-100 text-2xl">🕐</div>
          <p className="mt-4 text-sm font-semibold text-slate-800">นอกช่วงเวลาทำรายการ</p>
          <p className="mt-1 max-w-xs text-xs text-slate-500">
            ไม่สามารถสร้างคำขอได้ในขณะนี้
            {opStatus.nextOpenAt ? ` · เปิดรับถัดไป ${opStatus.nextOpenAt}` : ""}
          </p>
          <button
            onClick={() => router.push("/app")}
            className="mt-6 h-10 rounded-full bg-brand-600 px-6 text-sm font-medium text-white shadow-sm shadow-brand-600/30"
          >
            กลับหน้าหลัก
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <LiffTopBar title="สร้างคำขอ" />
      <div className="space-y-5 p-4 pb-32">
        <ModeTabs modes={availableModes} active={mode} onChange={setMode} />

        {me === null ? (
          <div className="h-20 animate-pulse rounded-2xl border border-border bg-slate-50" />
        ) : (
          <RequesterBanner dept={dept} section={section} action={mode === "ISSUE_OUT" ? "เบิกออก" : "คืนเข้า"} palette={palette} />
        )}

        {mode === "RETURN_IN" && <ConditionPicker value={returnCondition} onChange={setReturnCondition} />}

        {needsReturnSource && (
          <ReturnSourcePicker value={returnSource} onChange={setReturnSource} palette={palette} />
        )}

        <ItemsSection
          items={items}
          palletTypes={palletTypes}
          onUpdate={updateItem}
          onAdd={addItem}
          onRemove={removeItem}
          balanceByKey={warehouseBalance}
          balanceCondition={mode === "ISSUE_OUT" ? "GOOD" : returnCondition}
          balanceLabel={mode === "ISSUE_OUT" ? "เบิกได้" : mode === "RETURN_IN" ? "ในคลังตอนนี้" : null}
          enforceMax={mode === "ISSUE_OUT"}
          palette={palette}
        />

        <MetaFields neededDate={neededDate} purpose={purpose} onDateChange={setNeededDate} onPurposeChange={setPurpose} palette={palette} />

        <ApproverPicker
          steps={routeSteps}
          picks={approverPicks}
          onPickChange={(stepOrder, approverId) =>
            setApproverPicks((prev) => ({ ...prev, [stepOrder]: approverId }))
          }
          currentUserId={me?.user?.id ?? null}
          palette={palette}
        />

        {ATTACHMENT_ENABLED && <AttachmentPicker files={files} onChange={setFiles} palette={palette} />}
        {ATTACHMENT_ENABLED && uploadStatus && <p className="rounded-lg bg-brand-50 p-3 text-xs text-brand-700">{uploadStatus}</p>}

        {err && <p className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{err}</p>}
        {!canSubmit && validationHint && <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">{validationHint}</p>}

        {submitWarnings.length > 0 && createdId && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-900">ส่งคำขอสำเร็จ — ข้อควรทราบ:</p>
            <ul className="mt-2 space-y-1">
              {submitWarnings.map((w, i) => (
                <li key={i} className="text-xs text-amber-800">
                  • {w}
                </li>
              ))}
            </ul>
            <button
              onClick={() => {
                router.replace("/app/requests");
                router.push(`/app/requests/${createdId}`);
              }}
              className="mt-3 h-10 w-full rounded-xl bg-amber-600 text-sm font-medium text-white"
            >
              ดูคำขอ
            </button>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-1/2 z-20 w-full max-w-md -translate-x-1/2 border-t border-border bg-white p-4">
        {submitWarnings.length === 0 && (
          <button
            onClick={submit}
            disabled={!canSubmit}
            className={twMerge(
              "h-12 w-full rounded-xl text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50",
              palette.submitBtn
            )}
          >
            {busy ? "กำลังส่ง..." : mode === "ISSUE_OUT" ? "ส่งคำขอเบิก" : "ส่งคำขอคืน"}
          </button>
        )}
      </div>
    </div>
  );
}
