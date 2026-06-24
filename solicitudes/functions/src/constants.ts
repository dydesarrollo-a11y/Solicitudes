import type {
  BusinessCalendar,
  Role,
  SlaSettings,
  TicketStatus
} from "./types";

export const TECHNICAL_STAGES: TicketStatus[] = ["matching", "sample", "report"];

/** Transiciones permitidas por rol (fuente de verdad del backend). */
export const TRANSITIONS: Record<
  TicketStatus,
  { to: TicketStatus; roles: Role[] }[]
> = {
  waiting: [{ to: "matching", roles: ["admin", "superadmin"] }],
  matching: [{ to: "sample", roles: ["technician", "admin", "superadmin"] }],
  sample: [{ to: "report", roles: ["technician", "admin", "superadmin"] }],
  report: [{ to: "delivered", roles: ["admin", "superadmin"] }],
  delivered: [],
  closed: []
};

export const STAGE_SLA_KEY: Record<TicketStatus, keyof SlaSettings | null> = {
  waiting: "waitingToMatching",
  matching: "matchingToSample",
  sample: "sampleToReport",
  report: "reportToDelivered",
  delivered: "deliveryConfirmation",
  closed: null
};

export const DEFAULT_SLA: SlaSettings = {
  assignCommitment: { value: 4, unit: "hours" },
  waitingToMatching: { value: 1, unit: "businessDays" },
  matchingToSample: { value: 2, unit: "businessDays" },
  sampleToReport: { value: 2, unit: "businessDays" },
  reportToDelivered: { value: 1, unit: "businessDays" },
  deliveryConfirmation: { value: 2, unit: "businessDays" },
  warningThresholdPct: 20
};

export const MX_HOLIDAYS_2026 = [
  "2026-01-01",
  "2026-02-02",
  "2026-03-16",
  "2026-05-01",
  "2026-09-16",
  "2026-11-16",
  "2026-12-25"
];

export const DEFAULT_CALENDAR: BusinessCalendar = {
  workStart: "08:00",
  workEnd: "18:00",
  timezone: "America/Mexico_City",
  workDays: [1, 2, 3, 4, 5],
  holidays: MX_HOLIDAYS_2026,
  customNonWorkingDays: []
};

export function stageEntryNotification(status: TicketStatus): string | null {
  switch (status) {
    case "matching":
      return "stage_matching";
    case "sample":
      return "stage_sample";
    case "report":
      return "stage_report";
    default:
      return null;
  }
}
