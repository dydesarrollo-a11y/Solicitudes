"use client";
/**
 * Servicios de datos (cliente). Las escrituras críticas pasan por callables;
 * las lecturas usan Firestore con onSnapshot en los hooks.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  serverTimestamp
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL
} from "firebase/storage";
import { db, functions, storage } from "./config";
import type {
  Attachment,
  BusinessCalendar,
  CreateTicketInput,
  SlaSettings,
  TicketStatus,
  AppUser,
  Role,
  UserStatus
} from "@/lib/types";

// ── Callables (backend autoritativo) ─────────────────────────
export const callCreateTicket = httpsCallable<CreateTicketInput, { ticketId: string }>(
  functions,
  "createTicket"
);
export const callAddAttachments = httpsCallable<
  { ticketId: string; attachments: Attachment[] },
  { ok: boolean }
>(functions, "addAttachments");
export const callMoveTicket = httpsCallable<
  { ticketId: string; to: TicketStatus },
  { ok: boolean }
>(functions, "moveTicket");
export const callSetCommitment = httpsCallable<
  { ticketId: string; commitmentDueAt: number },
  { ok: boolean }
>(functions, "setCommitmentDate");
export const callConfirmDelivery = httpsCallable<
  { ticketId: string },
  { ok: boolean }
>(functions, "confirmDelivery");
export const callForceClose = httpsCallable<
  { ticketId: string; reason: string },
  { ok: boolean }
>(functions, "forceClose");
export const callAssignRole = httpsCallable<
  { uid: string; role: Role },
  { ok: boolean }
>(functions, "assignRole");
export const callSetUserStatus = httpsCallable<
  { uid: string; status: UserStatus },
  { ok: boolean }
>(functions, "setUserStatus");

// ── Comentarios (escritura directa permitida por Rules) ──────
export async function addComment(
  ticketId: string,
  data: {
    authorUid: string;
    authorName: string;
    text: string;
    mentions: string[];
    attachments: Attachment[];
  }
): Promise<void> {
  const ref = collection(db, "tickets", ticketId, "comments");
  await setDoc(doc(ref), {
    ...data,
    createdAt: Date.now()
  });
}

// ── Adjuntos (Storage) ───────────────────────────────────────
export async function uploadAttachment(
  ticketId: string,
  file: File,
  user: { uid: string; name: string },
  kind: "general" | "technical" = "general"
): Promise<Attachment> {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const path = `tickets/${ticketId}/${id}-${file.name}`;
  const sRef = storageRef(storage, path);
  await uploadBytes(sRef, file, { contentType: file.type });
  const url = await getDownloadURL(sRef);
  return {
    id,
    name: file.name,
    url,
    contentType: file.type,
    size: file.size,
    uploadedByUid: user.uid,
    uploadedByName: user.name,
    uploadedAt: Date.now(),
    kind
  };
}

// ── Usuarios (lectura para Admin) ────────────────────────────
export async function fetchUsers(): Promise<AppUser[]> {
  const snap = await getDocs(query(collection(db, "users"), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => d.data() as AppUser);
}

// ── Configuración SLA / calendario (escribe SuperAdmin) ──────
export async function fetchSla(): Promise<SlaSettings | null> {
  const snap = await getDoc(doc(db, "slaSettings", "config"));
  return snap.exists() ? (snap.data() as SlaSettings) : null;
}
export async function saveSla(sla: SlaSettings, uid: string): Promise<void> {
  await setDoc(
    doc(db, "slaSettings", "config"),
    { ...sla, updatedAt: Date.now(), updatedBy: uid },
    { merge: true }
  );
}
export async function fetchCalendar(): Promise<BusinessCalendar | null> {
  const snap = await getDoc(doc(db, "businessCalendar", "config"));
  return snap.exists() ? (snap.data() as BusinessCalendar) : null;
}
export async function saveCalendar(
  cal: BusinessCalendar,
  uid: string
): Promise<void> {
  await setDoc(
    doc(db, "businessCalendar", "config"),
    { ...cal, updatedAt: Date.now(), updatedBy: uid },
    { merge: true }
  );
}

// ── Notificaciones ───────────────────────────────────────────
export async function markNotificationRead(notifId: string): Promise<void> {
  await updateDoc(doc(db, "notifications", notifId), { read: true });
}

// ── Directorio para menciones ────────────────────────────────
export async function fetchActiveUserEmails(): Promise<string[]> {
  const snap = await getDocs(
    query(collection(db, "users"), where("status", "==", "active"))
  );
  return snap.docs.map((d) => (d.data() as AppUser).email);
}

export { serverTimestamp };
