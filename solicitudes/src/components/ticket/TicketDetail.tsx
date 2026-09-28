"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useTicket } from "@/hooks/useTickets";
import {
  callMoveTicket,
  callSetCommitment,
  callConfirmDelivery,
  callForceClose
} from "@/lib/firebase/services";
import {
  allowedTransitions,
  canAssignCommitment,
  canConfirmDelivery,
  canEditTicket,
  canForceClose
} from "@/lib/business/permissions";
import { STATUS_LABEL } from "@/lib/business/constants";
import {
  PriorityBadge,
  TimeStatusDot,
  DeliveryBadge
} from "@/components/ui/Badges";
import { Spinner, ErrorState } from "@/components/ui/States";
import { CommentSection } from "./CommentSection";
import { HistoryList } from "./HistoryList";
import { AttachmentList } from "./AttachmentList";
import { EditTicketModal } from "./EditTicketModal";
import { Timer } from "@/components/kanban/Timer";

function fmtDateTime(ts: number | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}
function toDatetimeLocal(ts: number | null): string {
  const d = ts ? new Date(ts) : new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

export function TicketDetail({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const { firebaseUser, role } = useAuth();
  const { ticket, loading, error } = useTicket(ticketId);
  const [tab, setTab] = useState<"details" | "comments" | "history">("details");
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  if (loading) return <Spinner label="Cargando ticket…" />;
  if (error) return <ErrorState message={error} />;
  if (!ticket) return <ErrorState message="Ticket no encontrado o sin acceso." />;

  const uid = firebaseUser?.uid ?? "";
  const transitions = allowedTransitions(role, ticket.status);

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    setActionError(null);
    try {
      await fn();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Error en la acción.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <button onClick={() => router.push("/dashboard")} className="text-sm text-[var(--muted)] hover:underline">
        ← Volver al tablero
      </button>

      {/* Encabezado */}
      <div className="card-surface rounded-2xl p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-sm font-bold text-[var(--muted)]">{ticket.ticketId}</p>
            <h1 className="text-xl font-black">{ticket.productType}</h1>
            <p className="text-sm text-[var(--muted)]">{ticket.specification}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="chip bg-brand-black text-white">{STATUS_LABEL[ticket.status]}</span>
            <PriorityBadge priority={ticket.priority} />
            <Timer dueAt={ticket.currentStageDueAt} timeStatus={ticket.timeStatus} />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <TimeStatusDot status={ticket.timeStatus} />
          <DeliveryBadge status={ticket.deliveryConfirmationStatus} />
        </div>

        {/* Acciones */}
        <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">
          {canEditTicket(role, uid, ticket) && (
            <button
              className="btn-ghost"
              disabled={!!busy}
              onClick={() => setEditing(true)}
            >
              Editar solicitud
            </button>
          )}

          {transitions.map((to) => (
            <button
              key={to}
              className="btn-dark"
              disabled={!!busy}
              onClick={() => run(`move-${to}`, () => callMoveTicket({ ticketId, to }))}
            >
              {busy === `move-${to}` ? "Moviendo…" : `Mover a ${STATUS_LABEL[to]}`}
            </button>
          ))}

          {canAssignCommitment(role) && (
            <CommitmentControl
              current={ticket.commitmentDueAt}
              busy={busy === "commit"}
              onSave={(ms) =>
                run("commit", () => callSetCommitment({ ticketId, commitmentDueAt: ms }))
              }
            />
          )}

          {canConfirmDelivery(role, uid, ticket) && (
            <button
              className="btn-primary"
              disabled={!!busy}
              onClick={() => run("confirm", () => callConfirmDelivery({ ticketId }))}
            >
              {busy === "confirm" ? "Confirmando…" : "Confirmar entrega"}
            </button>
          )}

          {canForceClose(role) && !ticket.isClosed && (
            <ForceCloseControl
              busy={busy === "force"}
              onClose={(reason) => run("force", () => callForceClose({ ticketId, reason }))}
            />
          )}
        </div>
        {actionError && (
          <div className="mt-3">
            <ErrorState message={actionError} />
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1">
        {(["details", "comments", "history"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
              tab === t ? "bg-brand-yellow text-brand-black" : "hover:bg-black/5 dark:hover:bg-white/10"
            }`}
          >
            {t === "details" ? "Detalle" : t === "comments" ? "Comentarios" : "Historial"}
          </button>
        ))}
      </div>

      <div className="card-surface rounded-2xl p-5 shadow-card">
        {tab === "details" && (
          <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            <Field label="Solicitante" value={`${ticket.requesterName} (${ticket.requesterEmail})`} />
            <Field label="Cliente / proyecto" value={ticket.clientOrProject} />
            <Field label="Capacidad" value={`${ticket.capacityKg} kg`} />
            <Field
              label="Pedido aprox."
              value={ticket.approxProjectAmount.toLocaleString("es-MX", {
                style: "currency",
                currency: "MXN"
              })}
            />
            <Field label="Creado" value={fmtDateTime(ticket.createdAt)} />
            <Field label="Fecha compromiso" value={fmtDateTime(ticket.commitmentDueAt)} />
            <Field label="Vence etapa actual" value={fmtDateTime(ticket.currentStageDueAt)} />
            <Field label="Entregado" value={fmtDateTime(ticket.deliveredAt)} />
            {ticket.isClosed && (
              <Field label="Cerrado" value={fmtDateTime(ticket.closedAt)} />
            )}
            <div className="sm:col-span-2">
              <p className="label">Comentarios iniciales</p>
              <p className="whitespace-pre-wrap text-sm">{ticket.initialComments}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="label">Adjuntos</p>
              <AttachmentList items={ticket.attachments} />
            </div>
          </div>
        )}
        {tab === "comments" && <CommentSection ticket={ticket} />}
        {tab === "history" && <HistoryList ticketId={ticketId} />}
      </div>

      {editing && (
        <EditTicketModal
          ticket={ticket}
          onClose={() => setEditing(false)}
          onSaved={() => setEditing(false)}
        />
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="label">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

function CommitmentControl({
  current,
  busy,
  onSave
}: {
  current: number | null;
  busy: boolean;
  onSave: (ms: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(toDatetimeLocal(current));
  return (
    <div className="flex items-center gap-2">
      {!open ? (
        <button className="btn-ghost" onClick={() => setOpen(true)} disabled={busy}>
          {current ? "Cambiar compromiso" : "Asignar compromiso"}
        </button>
      ) : (
        <>
          <input
            type="datetime-local"
            className="input w-auto"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <button
            className="btn-primary"
            disabled={busy}
            onClick={() => {
              onSave(new Date(value).getTime());
              setOpen(false);
            }}
          >
            {busy ? "Guardando…" : "Guardar"}
          </button>
          <button className="btn-ghost" onClick={() => setOpen(false)}>
            Cancelar
          </button>
        </>
      )}
    </div>
  );
}

function ForceCloseControl({
  busy,
  onClose
}: {
  busy: boolean;
  onClose: (reason: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <div className="flex items-center gap-2">
      {!open ? (
        <button className="btn-ghost text-red-600" onClick={() => setOpen(true)}>
          Cierre forzado
        </button>
      ) : (
        <>
          <input
            className="input w-64"
            placeholder="Motivo obligatorio…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            className="btn-dark"
            disabled={busy || reason.trim().length < 5}
            onClick={() => onClose(reason.trim())}
          >
            {busy ? "Cerrando…" : "Confirmar cierre"}
          </button>
          <button className="btn-ghost" onClick={() => setOpen(false)}>
            Cancelar
          </button>
        </>
      )}
    </div>
  );
}
