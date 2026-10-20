"use client";

import { startTransition, useEffect, useState } from "react";
import { twMerge } from "tailwind-merge";
import { ImageViewer } from "@/app/_components/image-viewer";
import { Palette } from "./_types";

const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB before compression
const COMPRESS_MAX_WIDTH = 1280;
const COMPRESS_QUALITY = 0.82;

async function compressImage(file: File): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, COMPRESS_MAX_WIDTH / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
        },
        "image/jpeg",
        COMPRESS_QUALITY
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

export function AttachmentPicker({ files, onChange, palette }: { files: File[]; onChange: (next: File[]) => void; palette: Palette }) {
  const [warn, setWarn] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [previews, setPreviews] = useState<string[]>([]);

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    startTransition(() => setPreviews(urls));
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
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
    if (accepted.length) {
      setCompressing(true);
      const compressed = await Promise.all(accepted.map(compressImage));
      setCompressing(false);
      onChange([...files, ...compressed]);
    }
  }

  function removeAt(i: number) {
    onChange(files.filter((_, idx) => idx !== i));
  }

  const atMax = files.length >= MAX_ATTACHMENTS;
  const pickDisabled = atMax || compressing;

  return (
    <div className={twMerge("rounded-2xl border bg-white p-4", palette.border)}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-600">
          แนบรูป <span className="text-slate-400">(สูงสุด {MAX_ATTACHMENTS} รูป)</span>
        </p>
        <div className="flex items-center gap-3">
          {files.length > 0 && (
            <button type="button" onClick={() => setPreviewIndex(0)} className="text-xs font-semibold text-slate-700 hover:text-slate-900">
              ดูรูป ({files.length})
            </button>
          )}
          <label
            className={twMerge("text-xs font-semibold", pickDisabled ? "cursor-not-allowed text-slate-300" : twMerge("cursor-pointer", palette.link))}
          >
            {compressing ? "กำลังบีบอัด..." : "+ เพิ่มรูป"}
            <input type="file" accept="image/*" multiple capture="environment" disabled={pickDisabled} onChange={onPick} className="hidden" />
          </label>
        </div>
      </div>

      {warn && <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-800">{warn}</p>}

      {files.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-4 text-center text-xs text-slate-400">
          ยังไม่มีรูป — กด &quot;+ เพิ่มรูป&quot; เพื่อถ่ายหรือเลือกจากคลัง
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
