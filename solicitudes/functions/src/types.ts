// Contrato de dominio para el backend (espejo de src/lib/types).
export type Role =
  | "superadmin"
  | "admin"
  | "requester"
  | "technician"
  | "auditor";
export type UserStatus = "pending" | "active" | "disabled";
export type TicketStatus =
  | "waiting"
  | "matching"
  | "sample"
  | "report"
  | "delivered"
  | "closed";
export type Priority = "low" | "normal" | "high" | "urgent";
export type TimeStatus = "on_time" | "warning" | "late";
export type DeliveryConfirmationStatus =
  | "not_required"
  | "pending_confirmation"
  | "confirmed";
export type TimeUnit = "minutes" | "hours" | "businessDays";

export interface SlaDuration {
  value: number;
  unit: TimeUnit;
}
export interface SlaSettings {
  assignCommitment: SlaDuration;
  waitingToMatching: SlaDuration;
  matchingToSample: SlaDuration;
  sampleToReport: SlaDuration;
  reportToDelivered: SlaDuration;
  deliveryConfirmation: SlaDuration;
  warningThresholdPct: number;
}
export interface BusinessCalendar {
  workStart: string;
  workEnd: string;
  timezone: string;
  workDays: number[];
  holidays: string[];
  customNonWorkingDays: string[];
}
export interface Attachment {
  id: string;
  name: string;
  url: string;
  contentType: string;
  size: number;
  uploadedByUid: string;
  uploadedByName: string;
  uploadedAt: number;
  kind: "general" | "technical";
}
