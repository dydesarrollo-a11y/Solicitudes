// Triggers de Firestore: comentarios (menciones, contador, historial) y adjuntos.
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { db, FieldValue } from "./admin";
import {
  addHistory,
  createNotification,
  sendChatNotification,
  ticketPath,
  ticketUrl
} from "./notify";

/** Extrae menciones tipo @usuario@blendergroup.com o @usuario del texto. */
function extractMentions(text: string): string[] {
  const re = /@([a-zA-Z0-9._-]+@blendergroup\.com)/g;
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m[1]) found.add(m[1].toLowerCase());
  }
  return [...found];
}

export const onCommentCreate = onDocumentCreated(
  "tickets/{ticketId}/comments/{commentId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const comment = snap.data();
    const ticketId = event.params.ticketId;

    // Actualizar contador y registrar en historial.
    await db.collection("tickets").doc(ticketId).update({
      commentCount: FieldValue.increment(1),
      updatedAt: Date.now()
    });
    await addHistory(ticketId, {
      type: "comment",
      actorUid: comment.authorUid,
      actorName: comment.authorName,
      message: "Nuevo comentario."
    });

    // Resolver menciones (las del cliente + reescaneo del texto por seguridad).
    const mentions: string[] = Array.from(
      new Set([
        ...((comment.mentions as string[]) ?? []),
        ...extractMentions(String(comment.text ?? ""))
      ])
    );
    if (mentions.length === 0) return;

    const path = ticketPath(ticketId);
    const url = ticketUrl(ticketId);
    for (const email of mentions) {
      const userSnap = await db
        .collection("users")
        .where("email", "==", email)
        .where("status", "==", "active")
        .limit(1)
        .get();
      if (userSnap.empty) continue;
      const uid = userSnap.docs[0]!.id;
      await createNotification({
        recipientUid: uid,
        type: "mention",
        ticketId,
        title: `Te mencionaron · ${ticketId}`,
        body: `${comment.authorName}: ${String(comment.text).slice(0, 140)}`,
        link: path
      });
    }
    await sendChatNotification({
      type: "mention",
      ticketId,
      text: `💬 ${comment.authorName} mencionó a ${mentions.join(", ")} en *${ticketId}*. ${url}`
    });
  }
);
