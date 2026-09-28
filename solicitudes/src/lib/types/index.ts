/**
 * Tipos de dominio compartidos por toda la app.
 * Mantener en sincronía con functions/src/types.ts (mismo contrato).
 */

// ── Roles y usuarios ─────────────────────────────────────────
export type Role =
  | "superadmin"
  | "admin"
  | "requester"
  | "technician"
  | "auditor";

export type UserStatus = "pending" | "active" | "disabled";

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string | null;
  role: Role | null; // null = aún sin rol asignado
  status: UserStatus;
  createdAt: number; // epoch ms
  lastLoginAt?: number;
  updatedAt?: number;
  updatedBy?: string | null;
}

/** Lo que viaja en los custom claims del token de Auth. */
export interface AuthClaims {
  role: Role | null;
  status: UserStatus;
}

// ── Ticket ───────────────────────────────────────────────────
export type TicketStatus =
  | "waiting" // En espera
  | "matching" // Igualación
  | "sample" // Muestra
  | "report" // Reporte
  | "delivered" // Entregado
  | "closed"; // Cerrado (estado interno, no es columna)

export type Priority = "low" | "normal" | "high" | "urgent";

export type TimeStatus = "on_time" | "warning" | "late";

export type DeliveryConfirmationStatus =
  | "not_required"
  | "pending_confirmation"
  | "confirmed";

export interface Attachment {
  id: string;
  name: string; // nombre original
  url: string; // URL segura de Storage
  contentType: string;
  size: number; // bytes
  uploadedByUid: string;
  uploadedByName: string;
  uploadedAt: number;
  kind: "general" | "technical"; // adjunto del solicitante vs técnico
}

export interface Ticket {
  ticketId: string; // SOL-2026-0001 (= id del doc)
  createdAt: number;
  createdBy: string; // uid
  requesterName: string;
  requesterEmail: string;

  // Campos capturados por el Solicitante
  productType: string;
  specification: string;
  capacityKg: number;
  attachments: Attachment[];
  initialComments: string;
  approxProjectAmount: number; // monto económico aproximado
  clientOrProject: string;
  priority: Priority;

  // Estado del flujo
  status: TicketStatus;
  commitmentDueAt: number | null; // fecha compromiso (la asigna Admin)
  currentStageStartedAt: number;
  currentStageDueAt: number | null; // vencimiento SLA de la etapa actual
  timeStatus: TimeStatus;

  // Entrega / cierre
  deliveryConfirmationStatus: DeliveryConfirmationStatus;
  deliveredAt: number | null;
  deliveryConfirmedAt: number | null;
  deliveryConfirmedBy: string | null;
  closedAt: number | null;
  closedBy: string | null;
  isClosed: boolean;
  isArchived: boolean;

  // Contadores de UI (mantenidos por funciones/triggers)
  commentCount: number;
  attachmentCount: number;

  updatedAt: number;
  updatedBy: string | null;
}

/** Payload del formulario de creación (lo que envía el cliente a la function). */
export interface CreateTicketInput {
  productType: string;
  specification: string;
  capacityKg: number;
  initialComments: string;
  approxProjectAmount: number;
  clientOrProject: string;
  priority: Priority;
  attachments: Attachment[];
}

// ── Comentarios ──────────────────────────────────────────────
export interface Comment {
  id: string;
  authorUid: string;
  authorName: string;
  text: string;
  mentions: string[]; // emails mencionados
  attachments: Attachment[];
  createdAt: number;
}

// ── Historial / auditoría ────────────────────────────────────
export type HistoryEventType =
  | "created"
  | "status_change"
  | "commitment_change"
  | "priority_change"
  | "comment"
  | "attachment_added"
  | "notification_sent"
  | "time_status_change"
  | "delivered"
  | "delivery_confirmed"
  | "closed"
  | "force_closed"
  | "edited";

export interface HistoryEvent {
  id: string;
  type: HistoryEventType;
  actorUid: string;
  actorName: string;
  at: number;
  message: string;
  before?: unknown;
  after?: unknown;
}

// ── Notificaciones ───────────────────────────────────────────
export type NotificationType =
  | "ticket_created"
  | "stage_matching"
  | "stage_sample"
  | "stage_report"
  | "commitment_assigned"
  | "delivered_confirm_required"
  | "ticket_closed"
  | "mention"
  | "sla_warning"
  | "sla_late"
  | "delivery_late"
  | "new_user_request"
  | "notification_error"
  | "ticket_edited";

export interface AppNotification {
  id: string;
  recipientUid: string | null; // destinatario individual
  recipientRole: Role | null; // o destinatario por grupo (técnicos)
  type: NotificationType;
  ticketId: string | null;
  title: string;
  body: string;
  link: string;
  read: boolean;
  createdAt: number;
}

// ── SLA / Calendario ─────────────────────────────────────────
export type TimeUnit = "minutes" | "hours" | "businessDays";

export interface SlaDuration {
  value: number;
  unit: TimeUnit;
}

export interface SlaSettings {
  assignCommitment: SlaDuration; // tiempo para asignar fecha compromiso
  waitingToMatching: SlaDuration;
  matchingToSample: SlaDuration;
  sampleToReport: SlaDuration;
  reportToDelivered: SlaDuration;
  deliveryConfirmation: SlaDuration; // tiempo para que el Solicitante confirme
  warningThresholdPct: number; // % restante para pasar a "warning" (ej. 20)
  updatedAt?: number;
  updatedBy?: string;
}

export interface BusinessCalendar {
  workStart: string; // "08:00"
  workEnd: string; // "18:00"
  timezone: string; // "America/Mexico_City"
  workDays: number[]; // [1,2,3,4,5] (0=domingo)
  holidays: string[]; // ["2026-09-16", ...] festivos oficiales MX
  customNonWorkingDays: string[]; // días personalizados del SuperAdmin
  updatedAt?: number;
  updatedBy?: string;
}

export interface ChatNotificationLog {
  id: string;
  ticketId: string | null;
  type: NotificationType;
  status: "sent" | "error";
  error?: string;
  createdAt: number;
}
