"use client";
import { useRouter } from "next/navigation";
import type { Ticket } from "@/lib/types";
import { PriorityBadge, TimeStatusDot } from "@/components/ui/Badges";
import { Timer } from "./Timer";

function fmtDate(ts: number | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short"
  });
}

export function TicketCard({ ticket }: { ticket: Ticket }) {
  const router = useRouter();
  const pendingConfirm =
    ticket.status === "delivered" &&
    ticket.deliveryConfirmationStatus === "pending_confirmation";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/ticket?id=${ticket.ticketId}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter") router.push(`/ticket?id=${ticket.ticketId}`);
      }}
      className={`card-surface w-full cursor-pointer rounded-xl p-3 text-left shadow-card transition-shadow hover:shadow-cardHover ${
        ticket.timeStatus === "late" ? "ring-2 ring-time-late" : ""
      }`}
    >
      <div className="mb-1.5 flex items-center justify-between">
        <span className="font-mono text-xs font-bold text-[var(--muted)]">
          {ticket.ticketId}
        </span>
        <PriorityBadge priority={ticket.priority} />
      </div>

      <p className="text-sm font-semibold leading-tight">{ticket.productType}</p>
      <p className="line-clamp-1 text-xs text-[var(--muted)]">
        {ticket.specification}
      </p>

      {pendingConfirm && (
        <p className="mt-2 rounded-md bg-brand-yellow/20 px-2 py-1 text-[11px] font-semibold text-[var(--text)]">
          Entregado · pendiente de confirmación
        </p>
      )}

      <div className="mt-2 flex items-center justify-between">
        <Timer dueAt={ticket.currentStageDueAt} timeStatus={ticket.timeStatus} />
        <span className="text-[11px] text-[var(--muted)]">
          Comp: {fmtDate(ticket.commitmentDueAt)}
        </span>
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-[var(--border)] pt-2">
        <span className="truncate text-[11px] text-[var(--muted)]">
          {ticket.requesterName}
        </span>
        <div className="flex items-center gap-2 text-[var(--muted)]">
          {ticket.attachmentCount > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[11px]">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
              {ticket.attachmentCount}
            </span>
          )}
          {ticket.commentCount > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[11px]">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              {ticket.commentCount}
            </span>
          )}
        </div>
      </div>

      <div className="mt-2">
        <TimeStatusDot status={ticket.timeStatus} />
      </div>
    </div>
  );
}
