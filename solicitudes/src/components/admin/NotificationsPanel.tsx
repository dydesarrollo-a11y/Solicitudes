"use client";
import { useEffect, useState } from "react";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  limit
} from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/hooks/useAuth";
import { Spinner, ErrorState } from "@/components/ui/States";
import type { ChatNotificationLog } from "@/lib/types";

interface NotifConfig {
  googleChatWebhook: string;
  enabled: boolean;
  disabledTypes: string[];
}

const TYPES: { key: string; label: string }[] = [
  { key: "ticket_created", label: "Ticket creado" },
  { key: "stage_matching", label: "Entra a Igualación" },
  { key: "stage_sample", label: "Entra a Muestra" },
  { key: "delivered_confirm_required", label: "Entregado / confirmar" },
  { key: "ticket_closed", label: "Ticket cerrado" },
  { key: "mention", label: "Menciones" },
  { key: "sla_warning", label: "Por vencer (SLA)" },
  { key: "sla_late", label: "Fuera de tiempo (SLA)" }
];

export function NotificationsPanel() {
  const { role } = useAuth();
  const [cfg, setCfg] = useState<NotifConfig>({
    googleChatWebhook: "",
    enabled: true,
    disabledTypes: []
  });
  const [logs, setLogs] = useState<ChatNotificationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isSuper = role === "superadmin";

  useEffect(() => {
    getDoc(doc(db, "notificationSettings", "config"))
      .then((s) => {
        if (s.exists()) setCfg({ ...cfg, ...(s.data() as NotifConfig) });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));

    const q = query(
      collection(db, "chatNotificationLogs"),
      orderBy("createdAt", "desc"),
      limit(20)
    );
    const unsub = onSnapshot(q, (snap) =>
      setLogs(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ChatNotificationLog, "id">) })))
    );
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleType(key: string) {
    setCfg((c) => ({
      ...c,
      disabledTypes: c.disabledTypes.includes(key)
        ? c.disabledTypes.filter((t) => t !== key)
        : [...c.disabledTypes, key]
    }));
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    setError(null);
    try {
      await setDoc(doc(db, "notificationSettings", "config"), cfg, { merge: true });
      setMsg("Configuración de notificaciones guardada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Spinner label="Cargando notificaciones…" />;

  return (
    <div className="space-y-5">
      <div className="card-surface space-y-4 rounded-xl p-5">
        {error && <ErrorState message={error} />}
        {msg && <p className="rounded-lg bg-green-50 p-2 text-sm text-green-700">{msg}</p>}

        <div>
          <label className="label">Webhook de Google Chat</label>
          <input
            className="input"
            placeholder="https://chat.googleapis.com/v1/spaces/…"
            value={cfg.googleChatWebhook}
            disabled={!isSuper}
            onChange={(e) => setCfg((c) => ({ ...c, googleChatWebhook: e.target.value }))}
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={cfg.enabled}
            disabled={!isSuper}
            onChange={(e) => setCfg((c) => ({ ...c, enabled: e.target.checked }))}
          />
          Notificaciones externas (Google Chat) activadas
        </label>

        <div>
          <label className="label">Tipos de notificación activos</label>
          <div className="flex flex-wrap gap-2">
            {TYPES.map((t) => {
              const on = !cfg.disabledTypes.includes(t.key);
              return (
                <button
                  key={t.key}
                  disabled={!isSuper}
                  onClick={() => toggleType(t.key)}
                  className={`chip px-3 py-1.5 ${
                    on
                      ? "bg-brand-yellow text-brand-black"
                      : "bg-black/5 text-[var(--muted)] line-through dark:bg-white/10"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {isSuper ? (
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? "Guardando…" : "Guardar notificaciones"}
          </button>
        ) : (
          <p className="text-sm text-[var(--muted)]">Solo SuperAdmin puede configurar notificaciones.</p>
        )}
      </div>

      <div className="card-surface rounded-xl p-5">
        <h3 className="mb-3 text-sm font-bold">Log de envíos a Google Chat</h3>
        {logs.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Sin registros.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {logs.map((l) => (
              <li key={l.id} className="flex items-center gap-2">
                <span className={l.status === "sent" ? "text-green-600" : "text-red-600"}>
                  {l.status === "sent" ? "✓" : "✗"}
                </span>
                <span className="font-mono text-xs">{l.type}</span>
                {l.ticketId && <span className="text-xs text-[var(--muted)]">{l.ticketId}</span>}
                {l.error && <span className="text-xs text-red-600">{l.error}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
