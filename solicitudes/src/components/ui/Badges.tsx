"use client";
import type { Priority, TimeStatus, DeliveryConfirmationStatus } from "@/lib/types";
import { PRIORITY_LABEL } from "@/lib/business/constants";

export function PriorityBadge({ priority }: { priority: Priority }) {
  const styles: Record<Priority, string> = {
    urgent: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    high: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    normal: "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-200",
    low: "bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400"
  };
  return <span className={`chip ${styles[priority]}`}>{PRIORITY_LABEL[priority]}</span>;
}

export function TimeStatusDot({ status }: { status: TimeStatus }) {
  const map: Record<TimeStatus, { c: string; label: string }> = {
    on_time: { c: "bg-time-ok", label: "En tiempo" },
    warning: { c: "bg-time-warning", label: "Por vencer" },
    late: { c: "bg-time-late", label: "Fuera de tiempo" }
  };
  const m = map[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)]">
      <span className={`h-2.5 w-2.5 rounded-full ${m.c}`} />
      {m.label}
    </span>
  );
}

export function DeliveryBadge({
  status
}: {
  status: DeliveryConfirmationStatus;
}) {
  if (status === "pending_confirmation") {
    return (
      <span className="chip bg-brand-yellow text-brand-black">
        Entregado · pendiente de confirmación del Solicitante
      </span>
    );
  }
  if (status === "confirmed") {
    return <span className="chip bg-green-100 text-green-700">Confirmado</span>;
  }
  return null;
}
