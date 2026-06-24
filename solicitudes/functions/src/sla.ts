// Barrido programado de SLA: recalcula timeStatus y dispara alertas de vencimiento.
import { onSchedule } from "firebase-functions/v2/scheduler";
import { db } from "./admin";
import { getSlaSettings, getCalendar } from "./authz";
import { computeTimeStatus } from "./businessTime";
import {
  addHistory,
  createNotification,
  notifyRole,
  sendChatNotification,
  ticketPath,
  ticketUrl
} from "./notify";
import { TECHNICAL_STAGES } from "./constants";
import type { TicketStatus, TimeStatus } from "./types";

/**
 * Se ejecuta cada 15 min (horario MX). Por cada ticket abierto:
 *  - Recalcula timeStatus (on_time | warning | late).
 *  - Si cambió, lo persiste, registra historial y notifica.
 *  - El ticket NO cambia de columna automáticamente.
 */
export const slaSweep = onSchedule(
  {
    schedule: "every 15 minutes",
    timeZone: "America/Mexico_City"
  },
  async () => {
    const sla = await getSlaSettings();
    const cal = await getCalendar();
    const now = new Date();

    const snap = await db
      .collection("tickets")
      .where("isClosed", "==", false)
      .get();

    for (const doc of snap.docs) {
      const t = doc.data();
      const status = t.status as TicketStatus;
      if (status === "closed") continue;

      const stageStart = t.currentStageStartedAt
        ? new Date(t.currentStageStartedAt)
        : null;
      const dueAt = t.currentStageDueAt ? new Date(t.currentStageDueAt) : null;
      if (!dueAt) continue;

      const prev = (t.timeStatus as TimeStatus) ?? "on_time";
      const next = computeTimeStatus(now, stageStart, dueAt, sla, cal);
      if (next === prev) continue;

      await doc.ref.update({ timeStatus: next, updatedAt: Date.now() });
      await addHistory(doc.id, {
        type: "time_status_change",
        actorUid: "system",
        actorName: "Sistema (SLA)",
        message: `Estado de tiempo: ${prev} → ${next} en etapa ${status}.`,
        before: prev,
        after: next
      });

      if (next === "warning" || next === "late") {
        await notifyStageResponsibles(doc.id, status, t, next);
      }
    }
  }
);

async function notifyStageResponsibles(
  ticketId: string,
  status: TicketStatus,
  t: FirebaseFirestore.DocumentData,
  level: "warning" | "late"
) {
  const path = ticketPath(ticketId);
  const url = ticketUrl(ticketId);
  const isTech = TECHNICAL_STAGES.includes(status);
  const type = level === "late" ? "sla_late" : "sla_warning";
  const emoji = level === "late" ? "🔴" : "🟡";
  const label = level === "late" ? "FUERA DE TIEMPO" : "por vencer";

  // Responsable operativo de etapas técnicas = grupo Técnico.
  if (isTech) {
    await notifyRole("technician", {
      type,
      ticketId,
      title: `${ticketId} ${label} · ${status}`,
      body: `El ticket está ${label} en la etapa ${status}.`
    });
  }
  // Caso especial: entrega no confirmada a tiempo.
  if (status === "delivered") {
    await createNotification({
      recipientUid: t.createdBy,
      type: "delivery_late",
      ticketId,
      title: `Confirmación pendiente ${label} · ${ticketId}`,
      body: `Aún no confirmas la entrega de tu ticket.`,
      link: path
    });
  }
  // Admin siempre se entera.
  await notifyRole("admin", {
    type,
    ticketId,
    title: `${ticketId} ${label} · ${status}`,
    body: `El ticket está ${label} en la etapa ${status}.`
  });
  await sendChatNotification({
    type,
    ticketId,
    text: `${emoji} *${ticketId}* ${label} en *${status}*. ${url}`
  });
}
