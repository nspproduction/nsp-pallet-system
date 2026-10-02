"use client";

import { useState } from "react";
import { ImageViewer, useAttachmentUrls } from "@/app/_components/image-viewer";

export function AttachmentGallery({
  attachments,
}: {
  attachments: { id: string; filePath: string }[];
}) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const urls = useAttachmentUrls(attachments.map((a) => a.id));
  const images = attachments
    .map((a) => ({ src: urls[a.id] ?? "", name: a.filePath.split("/").pop() }))
    .filter((img) => img.src);

  return (
    <>
      <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {attachments.map((a, i) => (
          <li key={a.id} className="aspect-square overflow-hidden rounded-xl bg-slate-100">
            {urls[a.id] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={urls[a.id]}
                alt={a.filePath.split("/").pop() ?? ""}
                onClick={() => setPreviewIndex(i)}
                className="h-full w-full cursor-zoom-in object-cover transition hover:opacity-90"
              />
            ) : (
              <div className="h-full w-full animate-pulse bg-slate-200" />
            )}
          </li>
        ))}
      </ul>
      {previewIndex !== null && images.length > 0 && (
        <ImageViewer images={images} startIndex={previewIndex} onClose={() => setPreviewIndex(null)} />
      )}
    </>
  );
}
