"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { fetchCalendar, saveCalendar } from "@/lib/firebase/services";
import { DEFAULT_CALENDAR } from "@/lib/business/constants";
import type { BusinessCalendar } from "@/lib/types";
import { Spinner, ErrorState } from "@/components/ui/States";

const WEEKDAYS = [
  { v: 1, l: "Lun" },
  { v: 2, l: "Mar" },
  { v: 3, l: "Mié" },
  { v: 4, l: "Jue" },
  { v: 5, l: "Vie" },
  { v: 6, l: "Sáb" },
  { v: 0, l: "Dom" }
];

export function CalendarPanel() {
  const { firebaseUser, role } = useAuth();
  const [cal, setCal] = useState<BusinessCalendar>(DEFAULT_CALENDAR);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newHoliday, setNewHoliday] = useState("");
  const [newCustom, setNewCustom] = useState("");

  const isSuper = role === "superadmin";

  useEffect(() => {
    fetchCalendar()
      .then((c) => setCal(c ?? DEFAULT_CALENDAR))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function toggleDay(v: number) {
    setCal((c) => ({
      ...c,
      workDays: c.workDays.includes(v)
        ? c.workDays.filter((d) => d !== v)
        : [...c.workDays, v].sort()
    }));
  }

  async function save() {
    if (!firebaseUser) return;
    setSaving(true);
    setMsg(null);
    setError(null);
    try {
      await saveCalendar(cal, firebaseUser.uid);
      setMsg("Calendario laboral guardado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Spinner label="Cargando calendario…" />;

  return (
    <div className="card-surface space-y-5 rounded-xl p-5">
      {error && <ErrorState message={error} />}
      {msg && <p className="rounded-lg bg-green-50 p-2 text-sm text-green-700">{msg}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Inicio de jornada</label>
          <input
            type="time"
            className="input"
            value={cal.workStart}
            disabled={!isSuper}
            onChange={(e) => setCal((c) => ({ ...c, workStart: e.target.value }))}
          />
        </div>
        <div>
          <label className="label">Fin de jornada</label>
          <input
            type="time"
            className="input"
            value={cal.workEnd}
            disabled={!isSuper}
            onChange={(e) => setCal((c) => ({ ...c, workEnd: e.target.value }))}
          />
        </div>
      </div>

      <div>
        <label className="label">Días laborables</label>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((d) => (
            <button
              key={d.v}
              disabled={!isSuper}
              onClick={() => toggleDay(d.v)}
              className={`chip px-3 py-1.5 ${
                cal.workDays.includes(d.v)
                  ? "bg-brand-yellow text-brand-black"
                  : "bg-black/5 text-[var(--muted)] dark:bg-white/10"
              }`}
            >
              {d.l}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Zona horaria: {cal.timezone}
        </p>
      </div>

      <DateListEditor
        title="Días festivos oficiales"
        items={cal.holidays}
        editable={isSuper}
        value={newHoliday}
        onValue={setNewHoliday}
        onAdd={(d) => setCal((c) => ({ ...c, holidays: [...new Set([...c.holidays, d])].sort() }))}
        onRemove={(d) => setCal((c) => ({ ...c, holidays: c.holidays.filter((x) => x !== d) }))}
      />

      <DateListEditor
        title="Días no laborables personalizados"
        items={cal.customNonWorkingDays}
        editable={isSuper}
        value={newCustom}
        onValue={setNewCustom}
        onAdd={(d) =>
          setCal((c) => ({
            ...c,
            customNonWorkingDays: [...new Set([...c.customNonWorkingDays, d])].sort()
          }))
        }
        onRemove={(d) =>
          setCal((c) => ({
            ...c,
            customNonWorkingDays: c.customNonWorkingDays.filter((x) => x !== d)
          }))
        }
      />

      {isSuper ? (
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? "Guardando…" : "Guardar calendario"}
        </button>
      ) : (
        <p className="text-sm text-[var(--muted)]">Solo SuperAdmin puede editar el calendario.</p>
      )}
    </div>
  );
}

function DateListEditor({
  title,
  items,
  editable,
  value,
  onValue,
  onAdd,
  onRemove
}: {
  title: string;
  items: string[];
  editable: boolean;
  value: string;
  onValue: (v: string) => void;
  onAdd: (d: string) => void;
  onRemove: (d: string) => void;
}) {
  return (
    <div>
      <label className="label">{title}</label>
      <div className="mb-2 flex flex-wrap gap-2">
        {items.length === 0 && (
          <span className="text-xs text-[var(--muted)]">Ninguno.</span>
        )}
        {items.map((d) => (
          <span key={d} className="chip bg-black/5 dark:bg-white/10">
            {d}
            {editable && (
              <button onClick={() => onRemove(d)} className="ml-1 text-red-600">
                ×
              </button>
            )}
          </span>
        ))}
      </div>
      {editable && (
        <div className="flex gap-2">
          <input
            type="date"
            className="input w-auto"
            value={value}
            onChange={(e) => onValue(e.target.value)}
          />
          <button
            className="btn-ghost"
            disabled={!value}
            onClick={() => {
              onAdd(value);
              onValue("");
            }}
          >
            Agregar
          </button>
        </div>
      )}
    </div>
  );
}
