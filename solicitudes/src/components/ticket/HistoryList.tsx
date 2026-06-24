"use client";
import { useHistory } from "@/hooks/useTicketSub";
import type { HistoryEventType } from "@/lib/types";

const ICONS: Record<HistoryEventType, string> = {
  created: "✦",
  status_change: "→",
  commitment_change: "📅",
  priority_change: "⚑",
  comment: "💬",
  attachment_added: "📎",
  notification_sent: "🔔",
  time_status_change: "⏱",
  delivered: "📦",
  delivery_confirmed: "✅",
  closed: "🔒",
  force_closed: "⛔"
};

function fmt(ts: number): string {
  return new Date(ts).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function HistoryList({ ticketId }: { ticketId: string }) {
  const { events } = useHistory(ticketId);
  if (events.length === 0) {
    return <p className="text-sm text-[var(--muted)]">Sin eventos registrados.</p>;
  }
  return (
    <ol className="relative space-y-3 border-l border-[var(--border)] pl-4">
      {events.map((e) => (
        <li key={e.id} className="relative">
          <span className="absolute -left-[22px] flex h-4 w-4 items-center justify-center text-xs">
            {ICONS[e.type] ?? "•"}
          </span>
          <p className="text-sm">{e.message}</p>
          <p className="text-xs text-[var(--muted)]">
            {e.actorName} · {fmt(e.at)}
          </p>
        </li>
      ))}
    </ol>
  );
}
