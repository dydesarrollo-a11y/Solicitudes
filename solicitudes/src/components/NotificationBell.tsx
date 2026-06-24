"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useNotifications } from "@/hooks/useNotifications";
import { markNotificationRead } from "@/lib/firebase/services";
import type { AppNotification } from "@/lib/types";

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}

export function NotificationBell() {
  const { items, unreadCount } = useNotifications();
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function handleClick(n: AppNotification) {
    if (!n.read && n.recipientUid) {
      await markNotificationRead(n.id).catch(() => undefined);
    }
    setOpen(false);
    // Los enlaces se guardan relativos (/ticket?id=…). Limpiamos por si alguno
    // viniera con origen o basePath: next/navigation antepone el basePath solo.
    let path = n.link || "/dashboard";
    if (/^https?:\/\//.test(path)) path = path.replace(/^https?:\/\/[^/]+/, "");
    const bp = process.env.NEXT_PUBLIC_BASE_PATH || "";
    if (bp && path.startsWith(bp)) path = path.slice(bp.length) || "/";
    router.push(path);
  }

  return (
    <div className="relative">
      <button
        aria-label="Notificaciones"
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-full p-2 hover:bg-black/5 dark:hover:bg-white/10"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="card-surface absolute right-0 z-40 mt-2 max-h-[70vh] w-80 overflow-y-auto rounded-xl shadow-cardHover">
            <div className="border-b border-[var(--border)] px-4 py-3 text-sm font-semibold">
              Notificaciones
            </div>
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-[var(--muted)]">
                Sin notificaciones
              </p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`block w-full border-b border-[var(--border)] px-4 py-3 text-left hover:bg-black/5 dark:hover:bg-white/5 ${
                    !n.read ? "bg-brand-yellow/10" : ""
                  }`}
                >
                  <p className="text-sm font-semibold">{n.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-[var(--muted)]">{n.body}</p>
                  <p className="mt-1 text-[10px] text-[var(--muted)]">{timeAgo(n.createdAt)}</p>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
