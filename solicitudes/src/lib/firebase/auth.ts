"use client";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  setPersistence,
  browserLocalPersistence
} from "firebase/auth";
import { auth } from "./config";
import { ALLOWED_DOMAIN } from "@/lib/business/constants";

const provider = new GoogleAuthProvider();
// Restringe el selector de cuentas al dominio corporativo (no es seguridad real,
// la validación dura está en backend/rules, pero mejora la UX).
provider.setCustomParameters({ hd: ALLOWED_DOMAIN, prompt: "select_account" });

export async function signInWithGoogle(): Promise<void> {
  await setPersistence(auth, browserLocalPersistence);
  const cred = await signInWithPopup(auth, provider);
  const email = cred.user.email ?? "";
  if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
    await fbSignOut(auth);
    throw new Error(
      `Solo se permiten cuentas @${ALLOWED_DOMAIN}. Iniciaste con ${email}.`
    );
  }
}

export async function signOut(): Promise<void> {
  await fbSignOut(auth);
}
