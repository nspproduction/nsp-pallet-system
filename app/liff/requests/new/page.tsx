"use client";

// Library
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { twMerge } from "tailwind-merge";

// Components
import { LiffTopBar } from "../../_shared";
import { Skeleton } from "@/app/_components/ui";
import { ImageViewer } from "@/app/_components/image-viewer";

// Lib
import { safeFetchJson } from "../../_fetch";

interface PalletType {
  id: string;
  code: string;
  name: string;
}

interface Section {
  id: string;
  code: string;
  name: string;
}

interface MeResponse {
  authenticated: boolean;
  user?: {
    id: string;
    fullName: string;
    role: string;
    department?: { id: string; code: string; name: string } | null;
    section?: Section | null;
  };
}

type Mode = "RECEIVE_NEW" | "ISSUE_OUT" | "RETURN_IN";
type Condition = "USABLE" | "IN_REPAIR" | "UNUSABLE";

interface Item {
  palletTypeId: string;
  quantity: number;
}

interface BalanceRow {
  palletTypeId: string;
  condition: string;
  quantity: number;
  department: { code: string } | null;
}

const MODE_LABEL: Record<Mode, string> = {
  RECEIVE_NEW: "รับเข้าใหม่",
  ISSUE_OUT: "เบิกออก",
  RETURN_IN: "คืนเข้า"
};

const CONDITIONS: { value: Condition; label: string; tone: string }[] = [
  { value: "USABLE", label: "ดี", tone: "emerald" },
  { value: "IN_REPAIR", label: "ส่งซ่อม", tone: "amber" },
  { value: "UNUSABLE", label: "เสีย", tone: "rose" }
];

const INPUT_BASE = "w-full h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-brand-500";

export default function Page() {
  const router = useRouter();
  const [palletTypes, setPalletTypes] = useState<PalletType[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [warehouseBalance, setWarehouseBalance] = useState<Record<string, number>>({});

  const [mode, setMode] = useState<Mode>("ISSUE_OUT");
  const [sectionOverride, setSectionOverride] = useState<string>("");
  const [returnCondition, setReturnCondition] = useState<Condition>("USABLE");
  const [neededDate, setNeededDate] = useState(() => new Date().toLocaleDateString("sv-SE"));
  const [purpose, setPurpose] = useState("");
  const [items, setItems] = useState<Item[]>([{ palletTypeId: "", quantity: 1 }]);
  const [files, setFiles] = useState<File[]>([]);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const [pt, meRes, bal] = await Promise.all([
        safeFetchJson<PalletType[]>("/api/pallet-types"),
        safeFetchJson<MeResponse>("/api/auth/me"),
        safeFetchJson<BalanceRow[]>("/api/balances")
      ]);
      if (pt.error) setErr(pt.error);
      setPalletTypes(Array.isArray(pt.data) ? pt.data : []);
      if (meRes.data) setMe(meRes.data);
      if (Array.isArray(bal.data)) {
        const map: Record<string, number> = {};
        for (const row of bal.data) {
          if (row.department?.code !== "WH-PL") continue;
          map[`${row.palletTypeId}::${row.condition}`] = (map[`${row.palletTypeId}::${row.condition}`] ?? 0) + row.quantity;
        }
        setWarehouseBalance(map);
      }
      setLoading(false);
    })();
  }, []);

  const dept = me?.user?.department ?? null;
  const defaultSection = me?.user?.section ?? null;
  const canReceive = dept?.code === "WH";

  useEffect(() => {
    if (!dept) return;
    void (async () => {
      const res = await safeFetchJson<Section[]>(`/api/sections?departmentId=${dept.id}`);
      setSections(Array.isArray(res.data) ? res.data : []);
    })();
  }, [dept]);

  useEffect(() => {
    setSectionOverride(defaultSection?.id ?? "");
  }, [defaultSection]);

  useEffect(() => {
    if (!canReceive && mode === "RECEIVE_NEW") setMode("ISSUE_OUT");
  }, [canReceive, mode]);

  const availableModes = useMemo<Mode[]>(() => (canReceive ? ["RECEIVE_NEW", "ISSUE_OUT", "RETURN_IN"] : ["ISSUE_OUT", "RETURN_IN"]), [canReceive]);

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
    if (mode !== "RECEIVE_NEW" && !dept) {
      setErr("บัญชีของคุณยังไม่ได้ผูกกับแผนก กรุณาติดต่อ Admin");
      return;
    }
    const cleaned = items.filter((it) => it.palletTypeId && it.quantity > 0);
    if (cleaned.length === 0) {
      setErr("กรุณาเพิ่มรายการพาเลทอย่างน้อย 1 รายการ");
      return;
    }

    const type = mode === "RECEIVE_NEW" ? "RECEIVE_NEW" : mode === "ISSUE_OUT" ? "ISSUE_INTERNAL" : "RETURN_INTERNAL";
    const condition: Condition = mode === "RETURN_IN" ? returnCondition : "USABLE";
    const payload = {
      type,
      sectionId: mode === "RECEIVE_NEW" ? null : sectionOverride || null,
      neededDate: neededDate || null,
      purpose: purpose || null,
      items: cleaned.map((it) => ({ ...it, condition }))
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
      setErr(data.error ?? "สร้างไม่สำเร็จ");
      return;
    }
    const created = await res.json();

    if (files.length > 0) {
      try {
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          setUploadStatus(`กำลังอัปโหลดรูป ${i + 1}/${files.length}`);
          const urlRes = await fetch("/api/attachments/upload-url", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ requestId: created.id, filename: f.name })
          });
          if (!urlRes.ok) throw new Error("ขอ upload url ไม่สำเร็จ");
          const { path, signedUrl } = await urlRes.json();
          const putRes = await fetch(signedUrl, {
            method: "PUT",
            body: f,
            headers: { "content-type": f.type }
          });
          if (!putRes.ok) throw new Error("อัปโหลดไฟล์ไม่สำเร็จ");
          await fetch("/api/attachments", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              requestId: created.id,
              path,
              fileType: f.type,
              fileSize: f.size
            })
          });
        }
      } catch (e) {
        setErr(e instanceof Error ? `สร้างคำขอสำเร็จ แต่อัปโหลดรูปไม่สำเร็จ: ${e.message}` : "อัปโหลดรูปไม่สำเร็จ");
        setBusy(false);
        return;
      }
    }

    setBusy(false);
    router.push(`/liff/requests/${created.id}`);
  }

  const role = me?.user?.role;
  const canCreate = role === "REQUESTER" || role === "ADMIN";

  const effectiveCondition: Condition = mode === "RETURN_IN" ? returnCondition : "USABLE";
  const deptMissing = mode !== "RECEIVE_NEW" && !dept;
  const validItems = items.filter((it) => it.palletTypeId && it.quantity > 0);
  const hasPartialItem = items.some((it) => (!it.palletTypeId && it.quantity > 0) || (it.palletTypeId && it.quantity <= 0));
  const overBalance =
    mode === "ISSUE_OUT" &&
    validItems.some((it) => {
      const key = `${it.palletTypeId}::${effectiveCondition}`;
      return it.quantity > (warehouseBalance[key] ?? 0);
    });

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
            onClick={() => router.push("/liff")}
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
        <ModeTabs modes={availableModes} active={mode} onChange={setMode} disabledReceive={!canReceive} />

        {mode === "RECEIVE_NEW" ? (
          <ReceiveNewBanner />
        ) : me === null ? (
          <div className="h-20 animate-pulse rounded-2xl border border-border bg-slate-50" />
        ) : (
          <RequesterBanner
            dept={dept}
            sections={sections}
            selectedSectionId={sectionOverride}
            onSectionChange={setSectionOverride}
            lockedSection={defaultSection}
            action={mode === "ISSUE_OUT" ? "เบิกออก" : "คืนเข้า"}
          />
        )}

        {mode === "RETURN_IN" && <ConditionPicker value={returnCondition} onChange={setReturnCondition} />}

        <ItemsSection
          items={items}
          palletTypes={palletTypes}
          onUpdate={updateItem}
          onAdd={addItem}
          onRemove={removeItem}
          balanceByKey={warehouseBalance}
          balanceCondition={mode === "RECEIVE_NEW" ? null : mode === "ISSUE_OUT" ? "USABLE" : returnCondition}
          balanceLabel={mode === "ISSUE_OUT" ? "เบิกได้" : mode === "RETURN_IN" ? "ในคลังตอนนี้" : null}
          enforceMax={mode === "ISSUE_OUT"}
        />

        <MetaFields neededDate={neededDate} purpose={purpose} onDateChange={setNeededDate} onPurposeChange={setPurpose} />

        <AttachmentPicker files={files} onChange={setFiles} />

        {uploadStatus && <p className="rounded-lg bg-brand-50 p-3 text-xs text-brand-700">{uploadStatus}</p>}
        {err && <p className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{err}</p>}
        {!canSubmit && validationHint && (
          <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">{validationHint}</p>
        )}
      </div>

      <div className="fixed bottom-0 left-1/2 z-20 w-full max-w-md -translate-x-1/2 border-t border-border bg-white p-4">
        <button
          onClick={submit}
          disabled={!canSubmit}
          className="h-12 w-full rounded-xl bg-brand-600 text-sm font-semibold text-white shadow-sm shadow-brand-600/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? (uploadStatus ?? "กำลังส่ง...") : "ส่งคำขอ"}
        </button>
      </div>
    </div>
  );
}

function ModeTabs({
  modes,
  active,
  onChange,
  disabledReceive
}: {
  modes: Mode[];
  active: Mode;
  onChange: (m: Mode) => void;
  disabledReceive: boolean;
}) {
  return (
    <div>
      <div className="flex gap-2 rounded-xl bg-slate-100 p-1">
        {modes.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onChange(m)}
            className={twMerge(
              "flex-1 rounded-lg py-2.5 text-sm font-semibold transition",
              active === m ? "bg-white text-brand-700 shadow-sm" : "text-slate-600"
            )}
          >
            {MODE_LABEL[m]}
          </button>
        ))}
      </div>
      {disabledReceive && <p className="mt-1.5 text-[11px] text-slate-400">"รับเข้าใหม่" เฉพาะแผนกพัสดุเท่านั้น</p>}
    </div>
  );
}

function RequesterBanner({
  dept,
  sections,
  selectedSectionId,
  onSectionChange,
  lockedSection,
  action
}: {
  dept: { id: string; code: string; name: string } | null;
  sections: Section[];
  selectedSectionId: string;
  onSectionChange: (v: string) => void;
  lockedSection: Section | null;
  action: string;
}) {
  if (!dept) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        บัญชีของคุณยังไม่ได้ผูกกับแผนก กรุณาติดต่อ Admin
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-border bg-white p-4">
      <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{action}ในนาม</p>
      <p className="mt-1 text-base font-semibold text-slate-900">{dept.name}</p>

      {lockedSection ? (
        <div className="mt-3">
          <p className="text-xs font-medium text-slate-600">Section</p>
          <p className="mt-1 text-sm text-slate-900">{lockedSection.name}</p>
        </div>
      ) : (
        sections.length > 0 && (
          <label className="mt-3 block">
            <span className="text-xs font-medium text-slate-600">Section</span>
            <select value={selectedSectionId} onChange={(e) => onSectionChange(e.target.value)} className={twMerge(INPUT_BASE, "mt-1")}>
              <option value="">- ไม่ระบุ -</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )
      )}
    </div>
  );
}

function ReceiveNewBanner() {
  return (
    <div className="rounded-2xl border border-brand-200 bg-brand-50/60 p-4">
      <p className="text-[11px] font-medium uppercase tracking-wider text-brand-700">รับเข้าใหม่</p>
      <p className="mt-1 text-sm font-semibold text-brand-900">รับพาเลทเข้าคลัง</p>
    </div>
  );
}

function ConditionPicker({ value, onChange }: { value: Condition; onChange: (c: Condition) => void }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-4">
      <p className="text-xs font-medium text-slate-600">
        สภาพพาเลทที่คืน <span className="text-slate-400">(1 สภาพต่อคำขอ)</span>
      </p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {CONDITIONS.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => onChange(c.value)}
            className={twMerge(
              "h-11 rounded-lg border text-sm font-semibold transition",
              value === c.value ? toneActive(c.tone) : "border-slate-200 bg-white text-slate-700"
            )}
          >
            {c.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-slate-500">หากต้องคืนหลายสภาพพร้อมกัน ให้สร้างคำขอแยกใบ</p>
    </div>
  );
}

function toneActive(tone: string) {
  if (tone === "emerald") return "border-emerald-500 bg-emerald-50 text-emerald-800";
  if (tone === "amber") return "border-amber-500 bg-amber-50 text-amber-800";
  return "border-rose-500 bg-rose-50 text-rose-800";
}

function ItemsSection({
  items,
  palletTypes,
  onUpdate,
  onAdd,
  onRemove,
  balanceByKey,
  balanceCondition,
  balanceLabel,
  enforceMax
}: {
  items: Item[];
  palletTypes: PalletType[];
  onUpdate: (index: number, patch: Partial<Item>) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  balanceByKey: Record<string, number>;
  balanceCondition: string | null;
  balanceLabel: string | null;
  enforceMax: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-600">รายการพาเลท</p>
        <button type="button" onClick={onAdd} className="text-xs font-semibold text-brand-700">
          + เพิ่มบรรทัด
        </button>
      </div>
      <div className="mt-3 space-y-3">
        {items.map((it, i) => {
          const key = balanceCondition && it.palletTypeId ? `${it.palletTypeId}::${balanceCondition}` : null;
          const available = key ? (balanceByKey[key] ?? 0) : null;
          const showBalance = balanceLabel && it.palletTypeId;
          const exceed = enforceMax && available !== null && it.quantity > available;
          return (
            <div key={i} className="rounded-xl bg-slate-50 p-3">
              <select value={it.palletTypeId} onChange={(e) => onUpdate(i, { palletTypeId: e.target.value })} className={INPUT_BASE}>
                <option value="">- เลือกประเภทพาเลท -</option>
                {palletTypes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {showBalance && (
                <p className={twMerge("mt-1.5 text-[11px]", exceed ? "font-semibold text-rose-600" : "text-slate-500")}>
                  {balanceLabel}: {available ?? 0} ตัว
                  {exceed && ` · เกินยอดคงเหลือ`}
                </p>
              )}
              <div className="mt-2 flex items-center gap-2">
                <QuantityStepper value={it.quantity} onChange={(q) => onUpdate(i, { quantity: q })} />
                <span className="text-xs text-slate-500">ตัว</span>
                {items.length > 1 && (
                  <button type="button" onClick={() => onRemove(i)} className="ml-auto text-xs font-medium text-rose-600">
                    ลบ
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QuantityStepper({ value, onChange }: { value: number; onChange: (q: number) => void }) {
  const btn = "grid h-9 w-9 place-items-center rounded-lg bg-white text-lg font-semibold text-slate-700 shadow-sm active:scale-95";
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => onChange(Math.max(1, value - 1))} className={btn}>
        −
      </button>
      <input
        type="number"
        min={1}
        value={value}
        onChange={(e) => onChange(Math.max(1, Number(e.target.value) || 1))}
        className="h-9 w-16 rounded-lg border border-slate-200 bg-white text-center text-sm"
      />
      <button type="button" onClick={() => onChange(value + 1)} className={btn}>
        +
      </button>
    </div>
  );
}

const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB

function AttachmentPicker({ files, onChange }: { files: File[]; onChange: (next: File[]) => void }) {
  const [warn, setWarn] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [previews, setPreviews] = useState<string[]>([]);

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (picked.length === 0) return;

    const errors: string[] = [];
    const accepted: File[] = [];
    const remaining = MAX_ATTACHMENTS - files.length;
    for (const f of picked) {
      if (!f.type.startsWith("image/")) {
        errors.push(`${f.name}: ต้องเป็นไฟล์รูป`);
        continue;
      }
      if (f.size > MAX_ATTACHMENT_BYTES) {
        errors.push(`${f.name}: ขนาดเกิน 10 MB`);
        continue;
      }
      if (accepted.length < remaining) accepted.push(f);
    }
    const over = picked.length - accepted.length - errors.length;
    if (over > 0) errors.push(`แนบได้สูงสุด ${MAX_ATTACHMENTS} รูป`);
    setWarn(errors.length ? errors.join(" · ") : null);
    if (accepted.length) onChange([...files, ...accepted]);
  }

  function removeAt(i: number) {
    onChange(files.filter((_, idx) => idx !== i));
  }

  const atMax = files.length >= MAX_ATTACHMENTS;

  return (
    <div className="rounded-2xl border border-border bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-600">
          แนบรูป <span className="text-slate-400">(สูงสุด {MAX_ATTACHMENTS} รูป, ไม่เกิน 10 MB)</span>
        </p>
        <div className="flex items-center gap-3">
          {files.length > 0 && (
            <button type="button" onClick={() => setPreviewIndex(0)} className="text-xs font-semibold text-slate-700 hover:text-slate-900">
              ดูรูป ({files.length})
            </button>
          )}
          <label className={`text-xs font-semibold ${atMax ? "cursor-not-allowed text-slate-300" : "cursor-pointer text-brand-700"}`}>
            + เพิ่มรูป
            <input type="file" accept="image/*" multiple capture="environment" disabled={atMax} onChange={onPick} className="hidden" />
          </label>
        </div>
      </div>

      {warn && <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-800">{warn}</p>}

      {files.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-4 text-center text-xs text-slate-400">
          ยังไม่มีรูป — กด "+ เพิ่มรูป" เพื่อถ่ายหรือเลือกจากคลัง
        </p>
      ) : (
        <ul className="mt-3 grid grid-cols-3 gap-2">
          {files.map((f, i) => (
            <li key={i} className="relative aspect-square overflow-hidden rounded-lg bg-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previews[i]} alt={f.name} onClick={() => setPreviewIndex(i)} className="h-full w-full cursor-zoom-in object-cover" />
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="absolute top-1 right-1 grid h-6 w-6 place-items-center rounded-full bg-slate-900/60 text-xs font-bold text-white"
                aria-label="ลบรูป"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {previewIndex !== null && previews.length > 0 && (
        <ImageViewer
          images={previews.map((src, i) => ({ src, name: files[i]?.name }))}
          startIndex={previewIndex}
          onClose={() => setPreviewIndex(null)}
        />
      )}
    </div>
  );
}

function MetaFields({
  neededDate,
  purpose,
  onDateChange,
  onPurposeChange
}: {
  neededDate: string;
  purpose: string;
  onDateChange: (v: string) => void;
  onPurposeChange: (v: string) => void;
}) {
  return (
    <div className="space-y-4 rounded-2xl border border-border bg-white p-4">
      <label className="block">
        <span className="text-xs font-medium text-slate-600">วันที่ต้องการ</span>
        <input type="date" value={neededDate} onChange={(e) => onDateChange(e.target.value)} className={twMerge(INPUT_BASE, "mt-1")} />
      </label>

      <label className="block">
        <span className="text-xs font-medium text-slate-600">วัตถุประสงค์ / เหตุผล</span>
        <textarea
          value={purpose}
          onChange={(e) => onPurposeChange(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
        />
      </label>
    </div>
  );
}
