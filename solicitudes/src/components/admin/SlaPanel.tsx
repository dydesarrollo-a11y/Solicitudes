"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { fetchSla, saveSla } from "@/lib/firebase/services";
import { DEFAULT_SLA } from "@/lib/business/constants";
import type { SlaDuration, SlaSettings, TimeUnit } from "@/lib/types";
import { Spinner, ErrorState } from "@/components/ui/States";

const FIELDS: { key: keyof SlaSettings; label: string }[] = [
  { key: "assignCommitment", label: "Asignar fecha compromiso (desde En espera)" },
  { key: "waitingToMatching", label: "En espera → Igualación" },
  { key: "matchingToSample", label: "Igualación → Muestra" },
  { key: "sampleToReport", label: "Muestra → Reporte" },
  { key: "reportToDelivered", label: "Reporte → Entregado" },
  { key: "deliveryConfirmation", label: "Confirmación de entrega (Solicitante)" }
];

const UNITS: { value: TimeUnit; label: string }[] = [
  { value: "minutes", label: "minutos" },
  { value: "hours", label: "horas" },
  { value: "businessDays", label: "días hábiles" }
];

export function SlaPanel() {
  const { firebaseUser, role } = useAuth();
  const [sla, setSla] = useState<SlaSettings>(DEFAULT_SLA);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isSuper = role === "superadmin";

  useEffect(() => {
    fetchSla()
      .then((s) => setSla(s ?? DEFAULT_SLA))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function setField(key: keyof SlaSettings, patch: Partial<SlaDuration>) {
    setSla((prev) => ({
      ...prev,
      [key]: { ...(prev[key] as SlaDuration), ...patch }
    }));
  }

  async function save() {
    if (!firebaseUser) return;
    setSaving(true);
    setMsg(null);
    setError(null);
    try {
      await saveSla(sla, firebaseUser.uid);
      setMsg("Configuración SLA guardada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Spinner label="Cargando SLA…" />;

  return (
    <div className="card-surface space-y-4 rounded-xl p-5">
      {error && <ErrorState message={error} />}
      {msg && <p className="rounded-lg bg-green-50 p-2 text-sm text-green-700">{msg}</p>}

      <div className="space-y-3">
        {FIELDS.map((f) => {
          const d = sla[f.key] as SlaDuration;
          return (
            <div key={String(f.key)} className="flex flex-wrap items-center gap-3">
              <span className="min-w-[260px] flex-1 text-sm">{f.label}</span>
              <input
                type="number"
                min="0"
                className="input w-24"
                value={d.value}
                disabled={!isSuper}
                onChange={(e) => setField(f.key, { value: Number(e.target.value) })}
              />
              <select
                className="input w-36"
                value={d.unit}
                disabled={!isSuper}
                onChange={(e) => setField(f.key, { unit: e.target.value as TimeUnit })}
              >
                {UNITS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
          );
        })}

        <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-3">
          <span className="min-w-[260px] flex-1 text-sm">
            Umbral “por vencer” (% de tiempo restante)
          </span>
          <input
            type="number"
            min="1"
            max="90"
            className="input w-24"
            value={sla.warningThresholdPct}
            disabled={!isSuper}
            onChange={(e) =>
              setSla((p) => ({ ...p, warningThresholdPct: Number(e.target.value) }))
            }
          />
        </div>
      </div>

      {isSuper ? (
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? "Guardando…" : "Guardar SLA"}
        </button>
      ) : (
        <p className="text-sm text-[var(--muted)]">Solo SuperAdmin puede editar el SLA.</p>
      )}
    </div>
  );
}
