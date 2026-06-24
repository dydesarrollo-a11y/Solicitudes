"use client";
import { useEffect, useState } from "react";
import type { TimeStatus } from "@/lib/types";

/** Cuenta regresiva hasta el vencimiento de la etapa (dueAt absoluto). */
export function Timer({
  dueAt,
  timeStatus
}: {
  dueAt: number | null;
  timeStatus: TimeStatus;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  if (!dueAt) {
    return <span className="text-xs text-[var(--muted)]">Sin SLA</span>;
  }

  const remaining = dueAt - now;
  const color =
    timeStatus === "late"
      ? "text-time-late"
      : timeStatus === "warning"
        ? "text-time-warning"
        : "text-time-ok";

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${color}`}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
      {remaining <= 0 ? "Vencido" : formatRemaining(remaining)}
    </span>
  );
}

function formatRemaining(ms: number): string {
  const totalMin = Math.floor(ms / 60000);
  const d = Math.floor(totalMin / (60 * 24));
  const h = Math.floor((totalMin % (60 * 24)) / 60);
  const m = totalMin % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
