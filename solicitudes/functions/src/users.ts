// Gestión de usuarios: alta automática, seed de SuperAdmins y asignación de roles.
import * as functionsV1 from "firebase-functions/v1";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { auth, db, ALLOWED_DOMAIN, SEED_SUPERADMINS } from "./admin";
import { requireRole } from "./authz";
import { createNotification } from "./notify";
import type { Role, UserStatus } from "./types";

const VALID_ROLES: Role[] = [
  "superadmin",
  "admin",
  "requester",
  "technician",
  "auditor"
];

/** Sincroniza los custom claims del token con el rol/estado del usuario. */
async function syncClaims(uid: string, role: Role | null, status: UserStatus) {
  await auth.setCustomUserClaims(uid, { role, status });
}

/**
 * Trigger al crear un usuario en Firebase Auth.
 * - Solo dominio @blendergroup.com.
 * - Los correos semilla se vuelven SuperAdmin activos.
 * - El resto queda 'pending' hasta que un SuperAdmin asigne rol.
 */
export const onUserCreate = functionsV1.auth.user().onCreate(async (user) => {
  const email = (user.email ?? "").toLowerCase();
  if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
    // Fuera de dominio: no se le da acceso (sin doc, sin claims).
    return;
  }

  const isSeed = SEED_SUPERADMINS.map((e) => e.toLowerCase()).includes(email);
  const role: Role | null = isSeed ? "superadmin" : null;
  const status: UserStatus = isSeed ? "active" : "pending";

  await db
    .collection("users")
    .doc(user.uid)
    .set({
      uid: user.uid,
      email,
      displayName: user.displayName ?? email,
      photoURL: user.photoURL ?? null,
      role,
      status,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      updatedBy: isSeed ? "system:seed" : null
    });

  await syncClaims(user.uid, role, status);

  if (!isSeed) {
    // Avisar a SuperAdmins que hay una solicitud de acceso.
    await createNotification({
      recipientRole: "superadmin",
      type: "new_user_request",
      title: "Nuevo usuario pendiente",
      body: `${email} solicita acceso. Asígnale un rol en el panel de administración.`,
      link: "/admin"
    });
  }
});

/** SuperAdmin asigna o cambia el rol de un usuario (y lo activa). */
export const assignRole = onCall(async (req) => {
  const caller = requireRole(req, ["superadmin"]);
  const { uid, role } = (req.data ?? {}) as { uid?: string; role?: Role };

  if (!uid || !role || !VALID_ROLES.includes(role)) {
    throw new HttpsError("invalid-argument", "uid y role válidos requeridos.");
  }
  const ref = db.collection("users").doc(uid);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Usuario no encontrado.");

  await ref.update({
    role,
    status: "active",
    updatedAt: Date.now(),
    updatedBy: caller.uid
  });
  await syncClaims(uid, role, "active");

  await createNotification({
    recipientUid: uid,
    type: "new_user_request",
    title: "Acceso autorizado",
    body: `Se te asignó el rol ${role}. Ya puedes usar Solicitudes.`,
    link: "/dashboard"
  });

  return { ok: true };
});

/** SuperAdmin activa o desactiva un usuario. */
export const setUserStatus = onCall(async (req) => {
  const caller = requireRole(req, ["superadmin"]);
  const { uid, status } = (req.data ?? {}) as {
    uid?: string;
    status?: UserStatus;
  };
  if (!uid || !status || !["active", "disabled", "pending"].includes(status)) {
    throw new HttpsError("invalid-argument", "uid y status válidos requeridos.");
  }
  if (uid === caller.uid) {
    throw new HttpsError("failed-precondition", "No puedes cambiar tu propio estado.");
  }
  const ref = db.collection("users").doc(uid);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Usuario no encontrado.");

  const role = snap.data()?.role ?? null;
  await ref.update({ status, updatedAt: Date.now(), updatedBy: caller.uid });
  await syncClaims(uid, role, status);
  return { ok: true };
});
