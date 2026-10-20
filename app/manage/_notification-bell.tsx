"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { twMerge } from "tailwind-merge";

type NotificationItem = {
  id: string;
  subject: string | null;
  body: string;
  linkUrl: string | null;
  readAt: string | null;
  createdAt: string;
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "เมื่อกี้";
  if (m < 60) return `${m} นาทีที่แล้ว`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ชั่วโมงที่แล้ว`;
  const d = Math.floor(h / 24);
  return `${d} วันที่แล้ว`;
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.items);
      setUnreadCount(data.unreadCount);
    } catch {
      // silent — non-critical
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch + polling (external sync)
    fetchNotifications();
    const id = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(id);
  }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        !buttonRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  async function markAllRead() {
    await fetch("/api/notifications/mark-read", { method: "POST" });
    setUnreadCount(0);
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
  }

  function handleClick(item: NotificationItem) {
    setOpen(false);
    if (!item.linkUrl) return;
    try {
      const { pathname, search } = new URL(item.linkUrl);
      router.push(pathname + search);
    } catch {
      router.push(item.linkUrl);
    }
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => {
          setOpen((v) => !v);
          if (!open) fetchNotifications();
        }}
        title="การแจ้งเตือน"
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border text-slate-500 hover:bg-slate-50 hover:text-slate-900"
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white leading-none">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-11 z-50 w-80 rounded-xl border border-border bg-white shadow-lg"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-semibold text-slate-900">การแจ้งเตือน</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-brand-600 hover:underline"
              >
                อ่านทั้งหมด
              </button>
            )}
          </div>

          {/* List */}
          <ul className="max-h-96 overflow-y-auto divide-y divide-border">
            {items.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-slate-400">
                ไม่มีการแจ้งเตือน
              </li>
            ) : (
              items.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => handleClick(n)}
                    className={twMerge(
                      "flex w-full gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors",
                      !n.readAt && "bg-brand-50",
                    )}
                  >
                    <span className={twMerge(
                      "mt-1 h-2 w-2 shrink-0 rounded-full",
                      n.readAt ? "bg-transparent" : "bg-brand-500",
                    )} />
                    <div className="min-w-0 flex-1">
                      {n.subject && (
                        <p className={twMerge(
                          "text-xs font-semibold truncate",
                          n.readAt ? "text-slate-500" : "text-slate-900",
                        )}>
                          {n.subject}
                        </p>
                      )}
                      <p className="text-xs text-slate-600 truncate">{n.body}</p>
                      <p className="mt-0.5 text-[10px] text-slate-400">{relativeTime(n.createdAt)}</p>
                    </div>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
