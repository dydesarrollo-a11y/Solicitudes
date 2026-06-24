// Utilidades de autorización para Cloud Functions callable.
import { HttpsError, CallableRequest } from "firebase-functions/v2/https";
import { db } from "./admin";
import {
  DEFAULT_CALENDAR,
  DEFAULT_SLA
} from "./constants";
import type {
  BusinessCalendar,
  Role,
  SlaSettings,
  UserStatus
} from "./types";

export interface Caller {
  uid: string;
  email: string;
  name: string;
  role: Role | null;
  status: UserStatus;
}

/** Extrae y valida al usuario que invoca la función. */
export function requireCaller(req: CallableRequest): Caller {
  const auth = req.auth;
  if (!auth) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  }
  const email = (auth.token.email as string | undefined) ?? "";
  if (!email.endsWith("@blendergroup.com")) {
    throw new HttpsError(
      "permission-denied",
      "Solo cuentas @blendergroup.com pueden usar el sistema."
    );
  }
  const role = (auth.token.role as Role | undefined) ?? null;
  const status = (auth.token.status as UserStatus | undefined) ?? "pending";
  return {
    uid: auth.uid,
    email,
    name: (auth.token.name as string | undefined) ?? email,
    role,
    status
  };
}

/** Exige que el usuario esté activo (rol asignado). */
export function requireActive(req: CallableRequest): Caller {
  const c = requireCaller(req);
  if (c.status !== "active" || !c.role) {
    throw new HttpsError(
      "permission-denied",
      "Tu cuenta está pendiente de autorización por un SuperAdmin."
    );
  }
  return c;
}

export function requireRole(req: CallableRequest, roles: Role[]): Caller {
  const c = requireActive(req);
  if (!roles.includes(c.role!)) {
    throw new HttpsError(
      "permission-denied",
      "No tienes permisos para esta acción."
    );
  }
  return c;
}

// ── Configuración (SLA + calendario), con creación por defecto ──
export async function getSlaSettings(): Promise<SlaSettings> {
  const ref = db.collection("slaSettings").doc("config");
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({ ...DEFAULT_SLA, updatedAt: Date.now() });
    return DEFAULT_SLA;
  }
  return snap.data() as SlaSettings;
}

export async function getCalendar(): Promise<BusinessCalendar> {
  const ref = db.collection("businessCalendar").doc("config");
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({ ...DEFAULT_CALENDAR, updatedAt: Date.now() });
    return DEFAULT_CALENDAR;
  }
  return snap.data() as BusinessCalendar;
}
