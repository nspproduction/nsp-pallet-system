"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  images: { src: string; name?: string }[];
  startIndex?: number;
  onClose: () => void;
}

export function ImageViewer({ images, startIndex = 0, onClose }: Props) {
  const [index, setIndex] = useState(startIndex);
  const touchStartX = useRef<number | null>(null);
  const count = images.length;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + count) % count);
      if (e.key === "ArrowRight") setIndex((i) => (i + 1) % count);
    }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [count, onClose]);

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 50) return;
    if (delta > 0) setIndex((i) => (i - 1 + count) % count);
    else setIndex((i) => (i + 1) % count);
  }

  if (count === 0) return null;
  const current = images[Math.min(index, count - 1)];

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-slate-950/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="flex items-center justify-between px-4 py-3 text-white" onClick={(e) => e.stopPropagation()}>
        <span className="text-xs text-white/70">
          {index + 1} / {count}
        </span>
        <button
          onClick={onClose}
          aria-label="ปิด"
          className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-lg hover:bg-white/20"
        >
          ✕
        </button>
      </div>

      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden px-2"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {count > 1 && (
          <button
            onClick={() => setIndex((i) => (i - 1 + count) % count)}
            aria-label="รูปก่อนหน้า"
            className="absolute left-2 z-10 hidden h-10 w-10 place-items-center rounded-full bg-white/10 text-xl text-white hover:bg-white/20 sm:grid"
          >
            ‹
          </button>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current.src}
          alt={current.name ?? ""}
          className="max-h-full max-w-full select-none object-contain"
          draggable={false}
        />
        {count > 1 && (
          <button
            onClick={() => setIndex((i) => (i + 1) % count)}
            aria-label="รูปถัดไป"
            className="absolute right-2 z-10 hidden h-10 w-10 place-items-center rounded-full bg-white/10 text-xl text-white hover:bg-white/20 sm:grid"
          >
            ›
          </button>
        )}
      </div>

      {count > 1 && (
        <div className="flex justify-center gap-1.5 py-3" onClick={(e) => e.stopPropagation()}>
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={`h-1.5 w-6 rounded-full transition ${i === index ? "bg-white" : "bg-white/30"}`}
              aria-label={`ไปที่รูปที่ ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function useAttachmentUrls(ids: string[]) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const entries = await Promise.all(
        ids.map(async (id) => {
          try {
            const res = await fetch(`/api/attachments/${id}/view-url`);
            if (!res.ok) return [id, ""] as const;
            const { url } = (await res.json()) as { url: string };
            return [id, url] as const;
          } catch {
            return [id, ""] as const;
          }
        }),
      );
      if (!cancelled) setUrls(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [ids.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps
  return urls;
}
