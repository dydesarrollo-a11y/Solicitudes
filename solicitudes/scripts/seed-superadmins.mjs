/**
 * Siembra/normaliza los SuperAdmins iniciales.
 *
 * Úsalo SOLO si los correos ya existían en Firebase Auth antes de desplegar
 * el trigger onUserCreate (que de lo contrario los crea automáticamente).
 *
 * Requisitos:
 *   1) Descarga la clave de servicio: Firebase Console > Project Settings >
 *      Service accounts > Generate new private key  →  serviceAccountKey.json
 *   2) Colócala en la raíz del proyecto (NO la subas a git; ya está en .gitignore).
 *   3) Ejecuta:  npm run seed
 */
import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const SEED_SUPERADMINS = [
  "amartinez@blendergroup.com",
  "dydesarrollo@blendergroup.com"
];

const serviceAccount = JSON.parse(
  readFileSync(new URL("../serviceAccountKey.json", import.meta.url), "utf8")
);

initializeApp({ credential: cert(serviceAccount) });
const auth = getAuth();
const db = getFirestore();

for (const email of SEED_SUPERADMINS) {
  try {
    let user;
    try {
      user = await auth.getUserByEmail(email);
    } catch {
      user = await auth.createUser({ email, emailVerified: true });
      console.log(`Creado en Auth: ${email}`);
    }

    await auth.setCustomUserClaims(user.uid, {
      role: "superadmin",
      status: "active"
    });

    await db
      .collection("users")
      .doc(user.uid)
      .set(
        {
          uid: user.uid,
          email: email.toLowerCase(),
          displayName: user.displayName ?? email,
          photoURL: user.photoURL ?? null,
          role: "superadmin",
          status: "active",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          updatedBy: "script:seed"
        },
        { merge: true }
      );

    console.log(`✓ SuperAdmin listo: ${email} (uid: ${user.uid})`);
  } catch (err) {
    console.error(`✗ Error con ${email}:`, err.message);
  }
}

console.log("Seed completado. Pide a esos usuarios cerrar y reabrir sesión.");
process.exit(0);
