import type {
  Priority,
  Role,
  SlaSettings,
  BusinessCalendar,
  TicketStatus
} from "@/lib/types";

export const ALLOWED_DOMAIN =
  process.env.NEXT_PUBLIC_ALLOWED_DOMAIN ?? "blendergroup.com";

/** Correos que deben sembrarse como SuperAdmin (también usado por la function de seed). */
export const SEED_SUPERADMINS = [
  "amartinez@blendergroup.com",
  "dydesarrollo@blendergroup.com"
];

// ── Columnas del Kanban (en orden) ───────────────────────────
export const BOARD_COLUMNS: { status: TicketStatus; label: string }[] = [
  { status: "waiting", label: "En espera" },
  { status: "matching", label: "Igualación" },
  { status: "sample", label: "Muestra" },
  { status: "report", label: "Reporte" },
  { status: "delivered", label: "Entregado" }
];

export const STATUS_LABEL: Record<TicketStatus, string> = {
  waiting: "En espera",
  matching: "Igualación",
  sample: "Muestra",
  report: "Reporte",
  delivered: "Entregado",
  closed: "Cerrado"
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  low: "Baja",
  normal: "Normal",
  high: "Alta",
  urgent: "Urgente"
};

export const PRIORITY_ORDER: Record<Priority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3
};

export const ROLE_LABEL: Record<Role, string> = {
  superadmin: "SuperAdmin",
  admin: "Administrador",
  requester: "Solicitante",
  technician: "Técnico",
  auditor: "Auditor"
};

/**
 * Transiciones permitidas por rol. Fuente de verdad usada tanto en el
 * cliente (para mostrar/ocultar acciones) como en la Cloud Function moveTicket.
 * Las etapas técnicas (matching→sample, sample→report) las puede hacer cualquier técnico.
 */
export const TRANSITIONS: Record<
  TicketStatus,
  { to: TicketStatus; roles: Role[] }[]
> = {
  waiting: [{ to: "matching", roles: ["admin", "superadmin"] }],
  matching: [{ to: "sample", roles: ["technician", "admin", "superadmin"] }],
  sample: [{ to: "report", roles: ["technician", "admin", "superadmin"] }],
  report: [{ to: "delivered", roles: ["admin", "superadmin"] }],
  delivered: [], // sólo se sale por confirmDelivery (Solicitante) o forceClose (SuperAdmin)
  closed: []
};

/** Qué SLA aplica al ENTRAR a cada estado (vencimiento de la etapa). */
export const STAGE_SLA_KEY: Record<TicketStatus, keyof SlaSettings | null> = {
  waiting: "waitingToMatching",
  matching: "matchingToSample",
  sample: "sampleToReport",
  report: "reportToDelivered",
  delivered: "deliveryConfirmation",
  closed: null
};

// ── Configuración por defecto (se escribe en el primer arranque) ──
export const DEFAULT_SLA: SlaSettings = {
  assignCommitment: { value: 4, unit: "hours" },
  waitingToMatching: { value: 1, unit: "businessDays" },
  matchingToSample: { value: 2, unit: "businessDays" },
  sampleToReport: { value: 2, unit: "businessDays" },
  reportToDelivered: { value: 1, unit: "businessDays" },
  deliveryConfirmation: { value: 2, unit: "businessDays" },
  warningThresholdPct: 20
};

/** Festivos oficiales de México (Ley Federal del Trabajo, art. 74) para 2026. */
export const MX_HOLIDAYS_2026 = [
  "2026-01-01", // Año Nuevo
  "2026-02-02", // Día de la Constitución (1er lunes de feb)
  "2026-03-16", // Natalicio de Benito Juárez (3er lunes de marzo)
  "2026-05-01", // Día del Trabajo
  "2026-09-16", // Independencia
  "2026-11-16", // Revolución (3er lunes de nov)
  "2026-12-25" // Navidad
];

export const DEFAULT_CALENDAR: BusinessCalendar = {
  workStart: "08:00",
  workEnd: "18:00",
  timezone: "America/Mexico_City",
  workDays: [1, 2, 3, 4, 5],
  holidays: MX_HOLIDAYS_2026,
  customNonWorkingDays: []
};
