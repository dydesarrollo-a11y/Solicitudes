/**
 * Punto de entrada de Cloud Functions — App "Solicitudes".
 *
 * Callable (httpsCallable desde el cliente):
 *   - createTicket, setCommitmentDate, moveTicket, confirmDelivery, forceClose
 *   - assignRole, setUserStatus
 *
 * Triggers:
 *   - onUserCreate (Auth): alta de usuario + seed de SuperAdmins
 *   - onCommentCreate (Firestore): menciones, contador, historial
 *
 * Programadas:
 *   - slaSweep: recálculo de estado de tiempo cada 15 min
 */
import { setGlobalOptions } from "firebase-functions/v2";

setGlobalOptions({ region: "us-central1", maxInstances: 10 });

export {
  createTicket,
  addAttachments,
  setCommitmentDate,
  moveTicket,
  confirmDelivery,
  forceClose
} from "./tickets";

export { onUserCreate, assignRole, setUserStatus } from "./users";
export { onCommentCreate } from "./triggers";
export { slaSweep } from "./sla";
