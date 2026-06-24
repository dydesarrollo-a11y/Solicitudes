"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useComments } from "@/hooks/useTicketSub";
import {
  addComment,
  uploadAttachment,
  fetchActiveUserEmails
} from "@/lib/firebase/services";
import type { Attachment, Ticket } from "@/lib/types";
import { canComment } from "@/lib/business/permissions";
import { AttachmentList } from "./AttachmentList";

function extractMentions(text: string): string[] {
  const re = /@([a-zA-Z0-9._-]+@blendergroup\.com)/g;
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) if (m[1]) out.add(m[1].toLowerCase());
  return [...out];
}

function fmt(ts: number): string {
  return new Date(ts).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function CommentSection({ ticket }: { ticket: Ticket }) {
  const { firebaseUser, profile, role } = useAuth();
  const { comments } = useComments(ticket.ticketId);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [emails, setEmails] = useState<string[]>([]);

  useEffect(() => {
    fetchActiveUserEmails().then(setEmails).catch(() => undefined);
  }, []);

  const allowed = canComment(role, firebaseUser?.uid ?? "", ticket);

  async function submit() {
    if (!text.trim() || !firebaseUser || !profile) return;
    setSending(true);
    try {
      let attachments: Attachment[] = [];
      if (files.length > 0) {
        attachments = await Promise.all(
          files.map((f) =>
            uploadAttachment(
              ticket.ticketId,
              f,
              { uid: firebaseUser.uid, name: profile.displayName },
              role === "technician" ? "technical" : "general"
            )
          )
        );
      }
      await addComment(ticket.ticketId, {
        authorUid: firebaseUser.uid,
        authorName: profile.displayName,
        text: text.trim(),
        mentions: extractMentions(text),
        attachments
      });
      setText("");
      setFiles([]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold">Comentarios</h3>

      <div className="space-y-3">
        {comments.length === 0 && (
          <p className="text-sm text-[var(--muted)]">Aún no hay comentarios.</p>
        )}
        {comments.map((c) => (
          <div key={c.id} className="rounded-lg border border-[var(--border)] p-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm font-semibold">{c.authorName}</span>
              <span className="text-xs text-[var(--muted)]">{fmt(c.createdAt)}</span>
            </div>
            <p className="whitespace-pre-wrap text-sm">{highlightMentions(c.text)}</p>
            {c.attachments?.length > 0 && (
              <div className="mt-2">
                <AttachmentList items={c.attachments} />
              </div>
            )}
          </div>
        ))}
      </div>

      {allowed ? (
        <div className="rounded-lg border border-[var(--border)] p-3">
          <textarea
            className="input min-h-[70px]"
            placeholder="Escribe un comentario… usa @correo@blendergroup.com para mencionar"
            value={text}
            onChange={(e) => setText(e.target.value)}
            list="mention-emails"
          />
          <datalist id="mention-emails">
            {emails.map((e) => (
              <option key={e} value={`@${e}`} />
            ))}
          </datalist>
          <div className="mt-2 flex items-center justify-between gap-2">
            <input
              type="file"
              multiple
              className="text-xs"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
            <button className="btn-primary" onClick={submit} disabled={sending || !text.trim()}>
              {sending ? "Enviando…" : "Comentar"}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-[var(--muted)]">
          No tienes permisos para comentar en este ticket.
        </p>
      )}
    </div>
  );
}

function highlightMentions(text: string) {
  const parts = text.split(/(@[a-zA-Z0-9._-]+@blendergroup\.com)/g);
  return parts.map((p, i) =>
    p.startsWith("@") ? (
      <span key={i} className="font-semibold text-amber-600 dark:text-amber-400">
        {p}
      </span>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}
