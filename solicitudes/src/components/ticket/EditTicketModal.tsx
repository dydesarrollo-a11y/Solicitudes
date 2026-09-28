"use client";
import { useState } from "react";
import { callUpdateTicket } from "@/lib/firebase/services";
import type { Priority, Ticket } from "@/lib/types";
import { ErrorState } from "@/components/ui/States";
import { Modal } from "@/components/CreateTicketForm";

interface FormState {
  productType: string;
  specification: string;
  capacityKg: string;
  initialComments: string;
  approxProjectAmount: string;
  clientOrProject: string;
  priority: Priority;
}

function friendlyError(err: unknown): string {
  // Los callables de Firebase exponen `.code` (ej. "functions/failed-precondition").
  const code = (err as { code?: string } | undefined)?.code ?? "";
  if (code.includes("failed-precondition")) {
    return "El ticket ya no está en “En espera” (alguien lo movió mientras editabas). Los cambios no se guardaron.";
  }
  if (code.includes("permission-denied")) {
    return "Ya no tienes permiso para editar este ticket.";
  }
  return err instanceof Error ? err.message : "No se pudo guardar la edición.";
}

export function EditTicketModal({
  ticket,
  onClose,
  onSaved
}: {
  ticket: Ticket; // prop en vivo: viene de useTicket (onSnapshot) en el padre
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>({
    productType: ticket.productType,
    specification: ticket.specification,
    capacityKg: String(ticket.capacityKg),
    initialComments: ticket.initialComments,
    approxProjectAmount: String(ticket.approxProjectAmount),
    clientOrProject: ticket.clientOrProject,
    priority: ticket.priority
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Si el ticket salió de "En espera" MIENTRAS el modal está abierto
  // (p.ej. un admin lo movió a Igualación), se refleja aquí solo, en vivo.
  const stillWaiting = ticket.status === "waiting";

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validate(): string | null {
    if (!form.productType.trim()) return "El tipo de producto es obligatorio.";
    if (!form.specification.trim()) return "La especificación/color es obligatoria.";
    const kg = Number(form.capacityKg);
    if (!Number.isFinite(kg) || kg <= 0) return "Captura una capacidad en kg válida.";
    if (!form.initialComments.trim()) return "Los comentarios iniciales son obligatorios.";
    const amount = Number(form.approxProjectAmount);
    if (!Number.isFinite(amount) || amount < 0) return "Captura un monto aproximado válido.";
    if (!form.clientOrProject.trim()) return "Indica el cliente o proyecto.";
    return null;
  }

  async function handleSubmit() {
    if (!stillWaiting) return; // el botón ya está disabled, esto es un cerrojo extra
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await callUpdateTicket({
        ticketId: ticket.ticketId,
        productType: form.productType.trim(),
        specification: form.specification.trim(),
        capacityKg: Number(form.capacityKg),
        initialComments: form.initialComments.trim(),
        approxProjectAmount: Number(form.approxProjectAmount),
        clientOrProject: form.clientOrProject.trim(),
        priority: form.priority
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={`Editar ${ticket.ticketId}`} onClose={onClose}>
      {!stillWaiting && (
        <div className="mb-4 rounded-lg border border-amber-400/50 bg-amber-400/10 px-3 py-2 text-sm font-medium text-amber-700 dark:text-amber-400">
          Este ticket ya no está en “En espera”, así que no se puede editar. Cierra
          esta ventana y revisa el estado actual.
        </div>
      )}

      <fieldset disabled={!stillWaiting || submitting} className="contents">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Tipo de producto *</label>
            <input
              className="input"
              value={form.productType}
              onChange={(e) => set("productType", e.target.value)}
            />
          </div>
          <div>
            <label className="label">Especificación / color *</label>
            <input
              className="input"
              value={form.specification}
              onChange={(e) => set("specification", e.target.value)}
            />
          </div>
          <div>
            <label className="label">Capacidad (kg) *</label>
            <input
              type="number"
              min="0"
              step="0.1"
              className="input"
              value={form.capacityKg}
              onChange={(e) => set("capacityKg", e.target.value)}
            />
          </div>
          <div>
            <label className="label">Pedido aprox. del proyecto (MXN) *</label>
            <input
              type="number"
              min="0"
              step="1"
              className="input"
              value={form.approxProjectAmount}
              onChange={(e) => set("approxProjectAmount", e.target.value)}
            />
          </div>
          <div>
            <label className="label">Cliente / proyecto *</label>
            <input
              className="input"
              value={form.clientOrProject}
              onChange={(e) => set("clientOrProject", e.target.value)}
            />
          </div>
          <div>
            <label className="label">Prioridad *</label>
            <select
              className="input"
              value={form.priority}
              onChange={(e) => set("priority", e.target.value as Priority)}
            >
              <option value="low">Baja</option>
              <option value="normal">Normal</option>
              <option value="high">Alta</option>
              <option value="urgent">Urgente</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Comentarios iniciales *</label>
            <textarea
              className="input min-h-[90px]"
              value={form.initialComments}
              onChange={(e) => set("initialComments", e.target.value)}
            />
          </div>
        </div>
      </fieldset>

      {error && (
        <div className="mt-3">
          <ErrorState message={error} />
        </div>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose} disabled={submitting}>
          {stillWaiting ? "Cancelar" : "Cerrar"}
        </button>
        {stillWaiting && (
          <button className="btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Guardando…" : "Guardar cambios"}
          </button>
        )}
      </div>
    </Modal>
  );
}
