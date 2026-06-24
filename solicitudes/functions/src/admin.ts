import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

if (getApps().length === 0) {
  initializeApp();
}

export const db = getFirestore();
export const auth = getAuth();
export { FieldValue };

export const ALLOWED_DOMAIN = "blendergroup.com";
export const SEED_SUPERADMINS = [
  "amartinez@blendergroup.com",
  "dydesarrollo@blendergroup.com"
];
