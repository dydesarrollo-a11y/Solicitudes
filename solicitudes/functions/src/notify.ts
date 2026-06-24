// Helpers de notificación: internas (Firestore) + externas (Google Chat).
import { db, FieldValue } from "./admin";
import type { Role } from "./types";

// URL pública del sitio en GitHub Pages (incluye basePath si es repo de proyecto),
// p.ej. https://miusuario.github.io/solicitudes  — configúrala con APP_BASE_URL.
const APP_BASE_URL =
  process.env.APP_BASE_URL ?? "https://EXAMPLE.github.io/solicitudes";

/** Ruta RELATIVA usada por los enlaces internos (la app le antepone el basePath). */
export function ticketPath(ticketId: string): string {
  return `/ticket?id=${ticketId}`;
}

/** URL ABSOLUTA usada en mensajes externos (Google Chat). */
export function ticketUrl(ticketId: string): string {
  return `${APP_BASE_URL}${ticketPath(ticketId)}`;
}

interface NotifyInput {
  recipientUid?: string | null;
  recipientRole?: Role | null; // p.ej. 'technician' para todo el grupo
  type: string;
  ticketId?: string | null;
  title: string;
  body: string;
  link?: string;
}

/** Crea una notificación interna (campana). */
export async function createNotification(n: NotifyInput): Promise<void> {
  await db.collection("notifications").add({
    recipientUid: n.recipientUid ?? null,
    recipientRole: n.recipientRole ?? null,
    type: n.type,
    ticketId: n.ticketId ?? null,
    title: n.title,
    body: n.body,
    link: n.link ?? (n.ticketId ? ticketPath(n.ticketId) : "/dashboard"),
    read: false,
    createdAt: Date.now()
  });
}

/** Notifica a TODOS los usuarios de un rol mediante un único doc de grupo. */
export async function notifyRole(role: Role, n: Omit<NotifyInput, "recipientRole" | "recipientUid">) {
  await createNotification({ ...n, recipientRole: role });
}

/** Devuelve los emails de usuarios activos con un rol dado. */
export async function activeUsersByRole(role: Role): Promise<string[]> {
  const snap = await db
    .collection("users")
    .where("role", "==", role)
    .where("status", "==", "active")
    .get();
  return snap.docs.map((d) => d.data().email as string).filter(Boolean);
}

/**
 * Envía un mensaje a Google Chat usando el webhook configurado en
 * businessCalendar/config? No: lo guardamos en slaSettings/chat o env.
 * Aquí leemos el webhook de la colección de configuración de notificaciones.
 */
async function getChatWebhook(): Promise<string | null> {
  const cfg = await db.collection("notificationSettings").doc("config").get();
  if (cfg.exists) {
    const url = cfg.data()?.googleChatWebhook;
    if (url) return url as string;
  }
  return process.env.GOOGLE_CHAT_WEBHOOK ?? null;
}

async function isChatEnabled(type: string): Promise<boolean> {
  const cfg = await db.collection("notificationSettings").doc("config").get();
  if (!cfg.exists) return true;
  const data = cfg.data();
  if (data?.enabled === false) return false;
  const disabledTypes: string[] = data?.disabledTypes ?? [];
  return !disabledTypes.includes(type);
}

/** Envía notificación externa a Google Chat y registra el resultado. */
export async function sendChatNotification(args: {
  type: string;
  ticketId?: string | null;
  text: string;
}): Promise<void> {
  const { type, ticketId, text } = args;
  if (!(await isChatEnabled(type))) return;

  const webhook = await getChatWebhook();
  if (!webhook) return; // no configurado: se omite silenciosamente

  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({ text })
    });
    if (!res.ok) throw new Error(`Google Chat HTTP ${res.status}`);
    await db.collection("chatNotificationLogs").add({
      ticketId: ticketId ?? null,
      type,
      status: "sent",
      createdAt: FieldValue.serverTimestamp()
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.collection("chatNotificationLogs").add({
      ticketId: ticketId ?? null,
      type,
      status: "error",
      error: message,
      createdAt: FieldValue.serverTimestamp()
    });
    // Avisar a admins de error de envío.
    await createNotification({
      recipientRole: "admin",
      type: "notification_error",
      ticketId: ticketId ?? null,
      title: "Error de notificación",
      body: `Falló el envío a Google Chat: ${message}`,
      link: "/admin"
    });
  }
}

/** Registra un evento en el historial del ticket. */
export async function addHistory(
  ticketId: string,
  event: {
    type: string;
    actorUid: string;
    actorName: string;
    message: string;
    before?: unknown;
    after?: unknown;
  }
): Promise<void> {
  await db
    .collection("tickets")
    .doc(ticketId)
    .collection("history")
    .add({
      ...event,
      before: event.before ?? null,
      after: event.after ?? null,
      at: Date.now()
    });
}
