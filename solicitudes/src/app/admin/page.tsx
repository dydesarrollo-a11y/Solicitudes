"use client";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { UsersPanel } from "@/components/admin/UsersPanel";
import { SlaPanel } from "@/components/admin/SlaPanel";
import { CalendarPanel } from "@/components/admin/CalendarPanel";
import { NotificationsPanel } from "@/components/admin/NotificationsPanel";

type Tab = "users" | "sla" | "calendar" | "notifications";

const TABS: { key: Tab; label: string }[] = [
  { key: "users", label: "Usuarios" },
  { key: "sla", label: "Configuración SLA" },
  { key: "calendar", label: "Calendario laboral" },
  { key: "notifications", label: "Notificaciones" }
];

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("users");
  return (
    <AppShell requireRoles={["admin", "superadmin"]}>
      <h1 className="mb-4 text-xl font-black tracking-tight">Administración</h1>
      <div className="mb-5 flex flex-wrap gap-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
              tab === t.key
                ? "bg-brand-yellow text-brand-black"
                : "hover:bg-black/5 dark:hover:bg-white/10"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "users" && <UsersPanel />}
      {tab === "sla" && <SlaPanel />}
      {tab === "calendar" && <CalendarPanel />}
      {tab === "notifications" && <NotificationsPanel />}
    </AppShell>
  );
}
