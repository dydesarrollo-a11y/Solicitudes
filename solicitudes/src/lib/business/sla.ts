/**
 * Lógica de SLA: cálculo de vencimiento de etapa y estado de tiempo.
 * Comparte businessTime.ts con el backend (misma fuente de verdad).
 */
import type {
  BusinessCalendar,
  SlaSettings,
  TicketStatus,
  TimeStatus
} from "@/lib/types";
import { STAGE_SLA_KEY } from "./constants";
import { addBusinessDuration, businessMinutesBetween } from "./businessTime";

/**
 * Calcula el vencimiento SLA de una etapa a partir de su inicio.
 * Devuelve null si la etapa no tiene SLA (p.ej. closed).
 */
export function computeStageDueAt(
  status: TicketStatus,
  stageStart: Date,
  sla: SlaSettings,
  cal: BusinessCalendar
): Date | null {
  const key = STAGE_SLA_KEY[status];
  if (!key) return null;
  const duration = sla[key];
  if (
    !duration ||
    typeof duration !== "object" ||
    !("value" in duration) ||
    !("unit" in duration)
  ) {
    return null;
  }
  return addBusinessDuration(stageStart, duration, cal);
}

/**
 * Estado de tiempo de un ticket dado "ahora", el inicio de etapa y el vencimiento.
 *  - on_time: queda más del umbral de tiempo hábil
 *  - warning: queda menos o igual al umbral (% configurable)
 *  - late: ya venció
 */
export function computeTimeStatus(
  now: Date,
  stageStart: Date | null,
  dueAt: Date | null,
  sla: SlaSettings,
  cal: BusinessCalendar
): TimeStatus {
  if (!dueAt) return "on_time";
  if (now.getTime() >= dueAt.getTime()) return "late";
  if (!stageStart) return "on_time";

  const totalMin = businessMinutesBetween(stageStart, dueAt, cal);
  const remainingMin = businessMinutesBetween(now, dueAt, cal);
  if (totalMin <= 0) return "on_time";

  const remainingPct = (remainingMin / totalMin) * 100;
  if (remainingPct <= sla.warningThresholdPct) return "warning";
  return "on_time";
}

/** Milisegundos hábiles restantes (para el timer del cliente). Nunca negativo. */
export function remainingBusinessMs(
  now: Date,
  dueAt: Date | null,
  cal: BusinessCalendar
): number {
  if (!dueAt) return 0;
  if (now.getTime() >= dueAt.getTime()) return 0;
  return businessMinutesBetween(now, dueAt, cal) * 60_000;
}

/** Formatea ms a "2d 3h 15m" para mostrar en la tarjeta. */
export function formatDuration(ms: number): string {
  if (ms <= 0) return "Vencido";
  const totalMin = Math.floor(ms / 60000);
  const days = Math.floor(totalMin / (60 * 8)); // jornada ≈ 8h hábiles
  const hours = Math.floor((totalMin % (60 * 8)) / 60);
  const mins = totalMin % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  parts.push(`${mins}m`);
  return parts.join(" ");
}
