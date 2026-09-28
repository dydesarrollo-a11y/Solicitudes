// Cloud Functions de tickets — ÚNICA vía de escritura crítica.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db, FieldValue } from "./admin";
import { requireActive, getSlaSettings, getCalendar } from "./authz";
import { TRANSITIONS } from "./constants";
import { computeStageDueAt, computeTimeStatus } from "./businessTime";
import {
  addHistory,
  createNotification,
  notifyRole,
  sendChatNotification,
  ticketPath,
  ticketUrl
} from "./notify";
import type {
  Attachment,
  Priority,
  Role,
  TicketStatus
} from "./types";

const VALID_PRIORITIES: Priority[] = ["low", "normal", "high", "urgent"];

/** Genera el folio SOL-YYYY-0001 de forma atómica con un contador. */
async function nextTicketId(): Promise<string> {
  const year = new Date().getFullYear();
  const ref = db.collection("counters").doc(`tickets-${year}`);
  const seq = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = (snap.exists ? (snap.data()?.value as number) : 0) ?? 0;
    const next = current + 1;
    tx.set(ref, { value: next }, { merge: true });
    return next;
  });
  return `SOL-${year}-${String(seq).padStart(4, "0")}`;
}

// ─────────────────────────────────────────────────────────────
// 1) Crear ticket (Solicitante / Admin / SuperAdmin)
// ─────────────────────────────────────────────────────────────
export const createTicket = onCall(async (req) => {
  const caller = requireActive(req);
  if (!["requester", "admin", "superadmin"].includes(caller.role!)) {
    throw new HttpsError("permission-denied", "No puedes crear tickets.");
  }
  const d = (req.data ?? {}) as Record<string, unknown>;

  const productType = String(d.productType ?? "").trim();
  const specification = String(d.specification ?? "").trim();
  const capacityKg = Number(d.capacityKg);
  const initialComments = String(d.initialComments ?? "").trim();
  const approxProjectAmount = Number(d.approxProjectAmount);
  const clientOrProject = String(d.clientOrProject ?? "").trim();
  const priority = d.priority as Priority;
  const attachments = (Array.isArray(d.attachments) ? d.attachments : []) as Attachment[];

  if (
    !productType ||
    !specification ||
    !Number.isFinite(capacityKg) ||
    capacityKg <= 0 ||
    !initialComments ||
    !Number.isFinite(approxProjectAmount) ||
    approxProjectAmount < 0 ||
    !clientOrProject ||
    !VALID_PRIORITIES.includes(priority)
  ) {
    throw new HttpsError("invalid-argument", "Faltan campos obligatorios o son inválidos.");
  }

  const now = Date.now();
  const ticketId = await nextTicketId();

  const ticket = {
    ticketId,
    createdAt: now,
    createdBy: caller.uid,
    requesterName: caller.name,
    requesterEmail: caller.email,
    productType,
    specification,
    capacityKg,
    attachments,
    initialComments,
    approxProjectAmount,
    clientOrProject,
    priority,
    status: "waiting" as TicketStatus,
    commitmentDueAt: null,
    currentStageStartedAt: now,
    currentStageDueAt: null, // se fija al asignar compromiso / mover
    timeStatus: "on_time" as const,
    deliveryConfirmationStatus: "not_required" as const,
    deliveredAt: null,
    deliveryConfirmedAt: null,
    deliveryConfirmedBy: null,
    closedAt: null,
    closedBy: null,
    isClosed: false,
    isArchived: false,
    commentCount: 0,
    attachmentCount: attachments.length,
    updatedAt: now,
    updatedBy: caller.uid
  };

  await db.collection("tickets").doc(ticketId).set(ticket);
  await addHistory(ticketId, {
    type: "created",
    actorUid: caller.uid,
    actorName: caller.name,
    message: `Ticket ${ticketId} creado en En espera.`,
    after: { status: "waiting", priority }
  });

  // Notificar a Admin/SuperAdmin del nuevo ticket.
  await notifyRole("admin", {
    type: "ticket_created",
    ticketId,
    title: `Nuevo ticket ${ticketId}`,
    body: `${caller.name} creó una solicitud (${productType} · ${specification}).`
  });
  await sendChatNotification({
    type: "ticket_created",
    ticketId,
    text: `🆕 *${ticketId}* creado por ${caller.name} — ${productType} / ${specification}. ${ticketUrl(ticketId)}`
  });

  return { ticketId };
});

// ─────────────────────────────────────────────────────────────
// 1b) Adjuntar archivos a un ticket existente (autor o admin/técnico)
// Se llama tras subir el archivo a Storage (la ruta exige ticket creado).
// ─────────────────────────────────────────────────────────────
export const addAttachments = onCall(async (req) => {
  const caller = requireActive(req);
  const { ticketId, attachments } = (req.data ?? {}) as {
    ticketId?: string;
    attachments?: Attachment[];
  };
  if (!ticketId || !Array.isArray(attachments) || attachments.length === 0) {
    throw new HttpsError("invalid-argument", "ticketId y attachments requeridos.");
  }
  const ref = db.collection("tickets").doc(ticketId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Ticket no encontrado.");
  const t = snap.data()!;

  const isOwner = t.createdBy === caller.uid && caller.role === "requester";
  const isStaff = ["admin", "superadmin", "technician"].includes(caller.role!);
  if (!isOwner && !isStaff) {
    throw new HttpsError("permission-denied", "No puedes adjuntar en este ticket.");
  }

  await ref.update({
    attachments: FieldValue.arrayUnion(...attachments),
    attachmentCount: FieldValue.increment(attachments.length),
    updatedAt: Date.now(),
    updatedBy: caller.uid
  });
  await addHistory(ticketId, {
    type: "attachment_added",
    actorUid: caller.uid,
    actorName: caller.name,
    message: `${attachments.length} adjunto(s) agregado(s).`
  });
  return { ok: true };
});

// ─────────────────────────────────────────────────────────────
// 2) Asignar / cambiar fecha compromiso (Admin / SuperAdmin)
// ─────────────────────────────────────────────────────────────
export const setCommitmentDate = onCall(async (req) => {
  const caller = requireActive(req);
  if (!["admin", "superadmin"].includes(caller.role!)) {
    throw new HttpsError("permission-denied", "Solo Admin/SuperAdmin asignan compromiso.");
  }
  const { ticketId, commitmentDueAt } = (req.data ?? {}) as {
    ticketId?: string;
    commitmentDueAt?: number;
  };
  if (!ticketId || !Number.isFinite(commitmentDueAt)) {
    throw new HttpsError("invalid-argument", "ticketId y commitmentDueAt requeridos.");
  }
  const ref = db.collection("tickets").doc(ticketId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Ticket no encontrado.");
  const t = snap.data()!;
  const before = t.commitmentDueAt ?? null;

  await ref.update({
    commitmentDueAt,
    updatedAt: Date.now(),
    updatedBy: caller.uid
  });
  await addHistory(ticketId, {
    type: "commitment_change",
    actorUid: caller.uid,
    actorName: caller.name,
    message: "Fecha compromiso asignada/actualizada.",
    before,
    after: commitmentDueAt
  });
  await createNotification({
    recipientUid: t.createdBy,
    type: "commitment_assigned",
    ticketId,
    title: `Fecha compromiso · ${ticketId}`,
    body: `Tu ticket tiene fecha compromiso: ${new Date(commitmentDueAt).toLocaleString("es-MX")}.`
  });
  return { ok: true };
});

// ─────────────────────────────────────────────────────────────
// 2b) Editar ticket (Solicitante dueño o Admin/SuperAdmin) — SOLO en "waiting"
// ─────────────────────────────────────────────────────────────
export const updateTicket = onCall(async (req) => {
  const caller = requireActive(req);
  const d = (req.data ?? {}) as Record<string, unknown>;
  const ticketId = String(d.ticketId ?? "");
  if (!ticketId) throw new HttpsError("invalid-argument", "ticketId requerido.");

  const ref = db.collection("tickets").doc(ticketId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Ticket no encontrado.");
  const t = snap.data()!;

  const isOwner = caller.role === "requester" && t.createdBy === caller.uid;
  const isStaff = ["admin", "superadmin"].includes(caller.role!);
  if (!isOwner && !isStaff) {
    throw new HttpsError("permission-denied", "No puedes editar este ticket.");
  }
  if (t.status !== "waiting") {
    throw new HttpsError(
      "failed-precondition",
      "Solo se puede editar la solicitud mientras está En espera."
    );
  }

  const productType = String(d.productType ?? "").trim();
  const specification = String(d.specification ?? "").trim();
  const capacityKg = Number(d.capacityKg);
  const initialComments = String(d.initialComments ?? "").trim();
  const approxProjectAmount = Number(d.approxProjectAmount);
  const clientOrProject = String(d.clientOrProject ?? "").trim();
  const priority = d.priority as Priority;

  if (
    !productType ||
    !specification ||
    !Number.isFinite(capacityKg) ||
    capacityKg <= 0 ||
    !initialComments ||
    !Number.isFinite(approxProjectAmount) ||
    approxProjectAmount < 0 ||
    !clientOrProject ||
    !VALID_PRIORITIES.includes(priority)
  ) {
    throw new HttpsError("invalid-argument", "Faltan campos obligatorios o son inválidos.");
  }

  const before = {
    productType: t.productType,
    specification: t.specification,
    capacityKg: t.capacityKg,
    initialComments: t.initialComments,
    approxProjectAmount: t.approxProjectAmount,
    clientOrProject: t.clientOrProject,
    priority: t.priority
  };
  const after = {
    productType,
    specification,
    capacityKg,
    initialComments,
    approxProjectAmount,
    clientOrProject,
    priority
  };

  await ref.update({
    ...after,
    updatedAt: Date.now(),
    updatedBy: caller.uid
  });

  await addHistory(ticketId, {
    type: "edited",
    actorUid: caller.uid,
    actorName: caller.name,
    message: "Solicitud editada mientras estaba En espera.",
    before,
    after
  });

  if (isOwner) {
    await notifyRole("admin", {
      type: "ticket_edited",
      ticketId,
      title: `Solicitud editada · ${ticketId}`,
      body: `${caller.name} editó los datos del ticket.`
    });
  }

  return { ok: true };
});

// ─────────────────────────────────────────────────────────────
// 3) Mover ticket entre columnas (valida transición + rol)
// ─────────────────────────────────────────────────────────────
export const moveTicket = onCall(async (req) => {
  const caller = requireActive(req);
  const { ticketId, to } = (req.data ?? {}) as {
    ticketId?: string;
    to?: TicketStatus;
  };
  if (!ticketId || !to) {
    throw new HttpsError("invalid-argument", "ticketId y destino requeridos.");
  }

  const ref = db.collection("tickets").doc(ticketId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Ticket no encontrado.");
  const t = snap.data()!;
  const from = t.status as TicketStatus;

  // Validar transición permitida para el rol.
  const allowed = (TRANSITIONS[from] ?? []).find(
    (tr) => tr.to === to && tr.roles.includes(caller.role as Role)
  );
  if (!allowed) {
    throw new HttpsError(
      "permission-denied",
      `Transición ${from} → ${to} no permitida para tu rol.`
    );
  }

  // Reglas de negocio adicionales:
  // - Para salir de "waiting" debe existir fecha compromiso.
  if (from === "waiting" && to === "matching" && !t.commitmentDueAt) {
    throw new HttpsError(
      "failed-precondition",
      "Asigna la fecha compromiso antes de mover a Igualación."
    );
  }

  const now = Date.now();
  const sla = await getSlaSettings();
  const cal = await getCalendar();

  const stageStart = new Date(now);
  const dueAt = computeStageDueAt(to, stageStart, sla, cal);
  const timeStatus = computeTimeStatus(
    stageStart,
    stageStart,
    dueAt,
    sla,
    cal
  );

  const update: Record<string, unknown> = {
    status: to,
    currentStageStartedAt: now,
    currentStageDueAt: dueAt ? dueAt.getTime() : null,
    timeStatus,
    updatedAt: now,
    updatedBy: caller.uid
  };

  // Entrada a "delivered": disparar confirmación del Solicitante.
  if (to === "delivered") {
    update.deliveryConfirmationStatus = "pending_confirmation";
    update.deliveredAt = now;
  }

  await ref.update(update);
  await addHistory(ticketId, {
    type: "status_change",
    actorUid: caller.uid,
    actorName: caller.name,
    message: `Estado: ${from} → ${to}.`,
    before: from,
    after: to
  });

  await dispatchStageNotifications(ticketId, to, t);
  return { ok: true };
});

/** Notificaciones por entrada a cada etapa. */
async function dispatchStageNotifications(
  ticketId: string,
  to: TicketStatus,
  t: FirebaseFirestore.DocumentData
) {
  const path = ticketPath(ticketId);
  const url = ticketUrl(ticketId);
  switch (to) {
    case "matching":
      await notifyRole("technician", {
        type: "stage_matching",
        ticketId,
        title: `Igualación · ${ticketId}`,
        body: `Nuevo ticket en Igualación: ${t.productType} / ${t.specification}.`
      });
      await createNotification({
        recipientUid: t.createdBy,
        type: "stage_matching",
        ticketId,
        title: `Tu ticket entró a Igualación · ${ticketId}`,
        body: `${t.productType} · ${t.specification} · Compromiso: ${
          t.commitmentDueAt ? new Date(t.commitmentDueAt).toLocaleString("es-MX") : "—"
        }`
      });
      await sendChatNotification({
        type: "stage_matching",
        ticketId,
        text: `🎨 *${ticketId}* entró a *Igualación*. ${url}`
      });
      break;
    case "sample":
      await notifyRole("technician", {
        type: "stage_sample",
        ticketId,
        title: `Muestra · ${ticketId}`,
        body: `Ticket en Muestra: ${t.productType} / ${t.specification}.`
      });
      await sendChatNotification({
        type: "stage_sample",
        ticketId,
        text: `🧪 *${ticketId}* entró a *Muestra*. ${url}`
      });
      break;
    case "report":
      await createNotification({
        recipientUid: t.createdBy,
        type: "stage_report",
        ticketId,
        title: `Reporte · ${ticketId}`,
        body: `Tu ticket está en etapa de Reporte.`
      });
      break;
    case "delivered":
      await createNotification({
        recipientUid: t.createdBy,
        type: "delivered_confirm_required",
        ticketId,
        title: `Entregado · ${ticketId} — Confirma la entrega`,
        body: `Revisa y confirma la entrega de tu ticket. Abre el ticket para confirmar.`,
        link: path
      });
      await notifyRole("admin", {
        type: "delivered_confirm_required",
        ticketId,
        title: `Entregado · ${ticketId}`,
        body: `El ticket pasó a Entregado y espera confirmación del Solicitante.`
      });
      await sendChatNotification({
        type: "delivered_confirm_required",
        ticketId,
        text: `📦 *${ticketId}* *Entregado* — pendiente de confirmación del Solicitante. ${url}`
      });
      break;
    default:
      break;
  }
}

// ─────────────────────────────────────────────────────────────
// 4) Confirmar entrega (solo el Solicitante dueño) → cierra ticket
// ─────────────────────────────────────────────────────────────
export const confirmDelivery = onCall(async (req) => {
  const caller = requireActive(req);
  const { ticketId } = (req.data ?? {}) as { ticketId?: string };
  if (!ticketId) throw new HttpsError("invalid-argument", "ticketId requerido.");

  const ref = db.collection("tickets").doc(ticketId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Ticket no encontrado.");
  const t = snap.data()!;

  if (caller.role !== "requester" || t.createdBy !== caller.uid) {
    throw new HttpsError("permission-denied", "Solo el Solicitante dueño confirma.");
  }
  if (t.status !== "delivered" || t.deliveryConfirmationStatus !== "pending_confirmation") {
    throw new HttpsError("failed-precondition", "El ticket no está pendiente de confirmación.");
  }

  const now = Date.now();
  await ref.update({
    deliveryConfirmationStatus: "confirmed",
    deliveryConfirmedAt: now,
    deliveryConfirmedBy: caller.uid,
    status: "closed",
    isClosed: true,
    isArchived: true,
    closedAt: now,
    closedBy: caller.uid,
    timeStatus: "on_time",
    currentStageDueAt: null,
    updatedAt: now,
    updatedBy: caller.uid
  });

  await addHistory(ticketId, {
    type: "delivery_confirmed",
    actorUid: caller.uid,
    actorName: caller.name,
    message: "El Solicitante confirmó la entrega.",
    after: { deliveryConfirmedBy: caller.uid }
  });
  await addHistory(ticketId, {
    type: "closed",
    actorUid: caller.uid,
    actorName: caller.name,
    message: "Ticket cerrado por confirmación del Solicitante.",
    after: { status: "closed" }
  });

  await notifyRole("admin", {
    type: "ticket_closed",
    ticketId,
    title: `Cerrado · ${ticketId}`,
    body: `${caller.name} confirmó la entrega. El ticket quedó cerrado.`
  });
  await sendChatNotification({
    type: "ticket_closed",
    ticketId,
    text: `✅ *${ticketId}* cerrado: ${caller.name} confirmó la entrega.`
  });

  return { ok: true };
});

// ─────────────────────────────────────────────────────────────
// 5) Cierre forzado (solo SuperAdmin, comentario obligatorio)
// ─────────────────────────────────────────────────────────────
export const forceClose = onCall(async (req) => {
  const caller = requireActive(req);
  if (caller.role !== "superadmin") {
    throw new HttpsError("permission-denied", "Solo SuperAdmin puede cerrar forzosamente.");
  }
  const { ticketId, reason } = (req.data ?? {}) as {
    ticketId?: string;
    reason?: string;
  };
  if (!ticketId) throw new HttpsError("invalid-argument", "ticketId requerido.");
  if (!reason || reason.trim().length < 5) {
    throw new HttpsError("invalid-argument", "El comentario de cierre forzado es obligatorio.");
  }

  const ref = db.collection("tickets").doc(ticketId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Ticket no encontrado.");

  const now = Date.now();
  await ref.update({
    status: "closed",
    isClosed: true,
    isArchived: true,
    closedAt: now,
    closedBy: caller.uid,
    deliveryConfirmationStatus: "confirmed",
    currentStageDueAt: null,
    updatedAt: now,
    updatedBy: caller.uid
  });
  // Comentario obligatorio queda registrado.
  await ref.collection("comments").add({
    authorUid: caller.uid,
    authorName: caller.name,
    text: `[Cierre forzado] ${reason.trim()}`,
    mentions: [],
    attachments: [],
    createdAt: now
  });
  await ref.update({ commentCount: FieldValue.increment(1) });
  await addHistory(ticketId, {
    type: "force_closed",
    actorUid: caller.uid,
    actorName: caller.name,
    message: `Cierre forzado por SuperAdmin. Motivo: ${reason.trim()}`,
    after: { status: "closed" }
  });
  await notifyRole("admin", {
    type: "ticket_closed",
    ticketId,
    title: `Cierre forzado · ${ticketId}`,
    body: `${caller.name} cerró forzosamente el ticket. Motivo: ${reason.trim()}`
  });
  return { ok: true };
});
