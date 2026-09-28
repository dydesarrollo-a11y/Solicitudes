/**
 * Reglas de permisos centralizadas. Se usan en el cliente para mostrar/ocultar
 * acciones. La autoridad final vive en Firestore Rules + Cloud Functions.
 */
import type { Role, Ticket, TicketStatus } from "@/lib/types";
import { TRANSITIONS } from "./constants";

export const TECHNICAL_STAGES: TicketStatus[] = ["matching", "sample", "report"];

export function isAdminLike(role: Role | null): boolean {
  return role === "admin" || role === "superadmin";
}

export function canAccessAdminPanel(role: Role | null): boolean {
  return role === "admin" || role === "superadmin";
}

export function canManageGlobalConfig(role: Role | null): boolean {
  return role === "superadmin";
}

export function canCreateTicket(role: Role | null): boolean {
  return role === "requester" || role === "admin" || role === "superadmin";
}

export function canViewMetrics(role: Role | null): boolean {
  return isAdminLike(role);
}

/** ¿El usuario puede ver este ticket? */
export function canViewTicket(
  role: Role | null,
  uid: string,
  ticket: Pick<Ticket, "createdBy" | "status">
): boolean {
  switch (role) {
    case "superadmin":
    case "admin":
    case "auditor":
      return true;
    case "technician":
      return TECHNICAL_STAGES.includes(ticket.status);
    case "requester":
      return ticket.createdBy === uid;
    default:
      return false;
  }
}

export function canComment(
  role: Role | null,
  uid: string,
  ticket: Pick<Ticket, "createdBy" | "status">
): boolean {
  if (role === "auditor" || role === null) return false;
  if (role === "requester") return ticket.createdBy === uid;
  if (role === "technician") return TECHNICAL_STAGES.includes(ticket.status);
  return isAdminLike(role); // admin/superadmin
}

export function canUploadAttachment(
  role: Role | null,
  uid: string,
  ticket: Pick<Ticket, "createdBy" | "status">
): boolean {
  return canComment(role, uid, ticket);
}

export function canAssignCommitment(role: Role | null): boolean {
  return isAdminLike(role);
}

/**
 * Puede editar los datos del ticket SOLO mientras está "En espera":
 * el Solicitante dueño, o Admin/SuperAdmin.
 */
export function canEditTicket(
  role: Role | null,
  uid: string,
  ticket: Pick<Ticket, "createdBy" | "status">
): boolean {
  if (ticket.status !== "waiting") return false;
  if (isAdminLike(role)) return true;
  return role === "requester" && ticket.createdBy === uid;
}

/** Transiciones de columna válidas para un rol desde el estado actual. */
export function allowedTransitions(
  role: Role | null,
  from: TicketStatus
): TicketStatus[] {
  if (!role) return [];
  return (TRANSITIONS[from] ?? [])
    .filter((t) => t.roles.includes(role))
    .map((t) => t.to);
}

export function canMove(
  role: Role | null,
  from: TicketStatus,
  to: TicketStatus
): boolean {
  return allowedTransitions(role, from).includes(to);
}

/** Sólo el Solicitante dueño puede confirmar la entrega, y sólo en "delivered" pendiente. */
export function canConfirmDelivery(
  role: Role | null,
  uid: string,
  ticket: Pick<
    Ticket,
    "createdBy" | "status" | "deliveryConfirmationStatus"
  >
): boolean {
  return (
    role === "requester" &&
    ticket.createdBy === uid &&
    ticket.status === "delivered" &&
    ticket.deliveryConfirmationStatus === "pending_confirmation"
  );
}

export function canForceClose(role: Role | null): boolean {
  return role === "superadmin";
}

export function canAssignRoles(role: Role | null): boolean {
  return role === "superadmin";
}

export function canViewAuditLog(role: Role | null): boolean {
  return role === "superadmin" || role === "auditor" || role === "admin";
}
