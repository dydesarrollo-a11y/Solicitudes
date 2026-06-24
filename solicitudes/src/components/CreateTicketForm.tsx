"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import {
  callCreateTicket,
  callAddAttachments,
  uploadAttachment
} from "@/lib/firebase/services";
import type { Priority } from "@/lib/types";
import { ErrorState } from "./ui/States";

interface FormState {
  productType: string;
  specification: string;
  capacityKg: string;
  initialComments: string;
  approxProjectAmount: string;
  clientOrProject: string;
  priority: Priority;
}

const INITIAL: FormState = {
  productType: "",
  specification: "",
  capacityKg: "",
  initialComments: "",
  approxProjectAmount: "",
  clientOrProject: "",
  priority: "normal"
};

export function CreateTicketModal({ onClose }: { onClose: () => void }) {
  const { firebaseUser, profile } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState<FormState>(INITIAL);
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    if (!firebaseUser || !profile) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await callCreateTicket({
        productType: form.productType.trim(),
        specification: form.specification.trim(),
        capacityKg: Number(form.capacityKg),
        initialComments: form.initialComments.trim(),
        approxProjectAmount: Number(form.approxProjectAmount),
        clientOrProject: form.clientOrProject.trim(),
        priority: form.priority,
        attachments: []
      });
      const ticketId = res.data.ticketId;

      if (files.length > 0) {
        const uploaded = await Promise.all(
          files.map((f) =>
            uploadAttachment(
              ticketId,
              f,
              { uid: firebaseUser.uid, name: profile.displayName },
              "general"
            )
          )
        );
        await callAddAttachments({ ticketId, attachments: uploaded });
      }

      onClose();
      router.push(`/ticket?id=${ticketId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el ticket.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Nueva solicitud" onClose={onClose}>
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
        <div className="sm:col-span-2">
          <label className="label">Adjuntos</label>
          <input
            type="file"
            multiple
            className="input"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
          {files.length > 0 && (
            <p className="mt-1 text-xs text-[var(--muted)]">
              {files.length} archivo(s) seleccionado(s)
            </p>
          )}
        </div>
      </div>

      <p className="mt-3 text-xs text-[var(--muted)]">
        La fecha compromiso la asigna un Administrador. El ticket se creará en
        “En espera”.
      </p>

      {error && (
        <div className="mt-3">
          <ErrorState message={error} />
        </div>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose} disabled={submitting}>
          Cancelar
        </button>
        <button className="btn-primary" onClick={handleSubmit} disabled={submitting}>
          {submitting ? "Creando…" : "Crear ticket"}
        </button>
      </div>
    </Modal>
  );
}

export function Modal({
  title,
  onClose,
  children
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="card-surface max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl p-6 shadow-cardHover">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 hover:bg-black/5 dark:hover:bg-white/10"
            aria-label="Cerrar"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
