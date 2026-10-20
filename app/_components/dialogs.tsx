"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Renders at document.body so dialogs always sit above all other UI layers.
function DialogPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- mount guard for createPortal (SSR safety)
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}

// ─── ConfirmDialog ───────────────────────────────────────────────────────────

interface ConfirmDialogProps {
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  message,
  confirmLabel = "ยืนยัน",
  cancelLabel = "ยกเลิก",
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <DialogPortal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
        <div className="w-full max-w-xs rounded-2xl bg-white shadow-xl">
          <div className="p-5">
            <p className="text-sm leading-relaxed text-slate-800">{message}</p>
          </div>
          <div className="flex gap-2 border-t border-slate-100 p-4">
            <button
              onClick={onCancel}
              className="h-10 flex-1 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              className={`h-10 flex-1 rounded-xl text-sm font-semibold text-white ${
                danger
                  ? "bg-rose-600 hover:bg-rose-700"
                  : "bg-brand-600 hover:bg-brand-700"
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </DialogPortal>
  );
}

// ─── PromptDialog ────────────────────────────────────────────────────────────

interface PromptDialogProps {
  label: string;
  initialValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export function PromptDialog({
  label,
  initialValue = "",
  placeholder,
  confirmLabel = "บันทึก",
  cancelLabel = "ยกเลิก",
  onConfirm,
  onCancel,
}: PromptDialogProps) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && value.trim()) onConfirm(value.trim());
    if (e.key === "Escape") onCancel();
  }

  return (
    <DialogPortal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
        <div className="w-full max-w-xs rounded-2xl bg-white shadow-xl">
          <div className="space-y-3 p-5">
            <p className="text-sm font-medium text-slate-800">{label}</p>
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKey}
              placeholder={placeholder}
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-brand-500"
            />
          </div>
          <div className="flex gap-2 border-t border-slate-100 p-4">
            <button
              onClick={onCancel}
              className="h-10 flex-1 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {cancelLabel}
            </button>
            <button
              onClick={() => value.trim() && onConfirm(value.trim())}
              disabled={!value.trim()}
              className="h-10 flex-1 rounded-xl bg-brand-600 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </DialogPortal>
  );
}
