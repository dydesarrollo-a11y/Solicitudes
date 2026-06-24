"use client";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Board } from "@/components/kanban/Board";
import { CreateTicketModal } from "@/components/CreateTicketForm";
import { useAuth } from "@/hooks/useAuth";
import { canCreateTicket } from "@/lib/business/permissions";

export default function DashboardPage() {
  const { role } = useAuth();
  const [showCreate, setShowCreate] = useState(false);

  return (
    <AppShell>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-black tracking-tight">Tablero</h1>
      </div>
      <Board
        onCreate={() => {
          if (canCreateTicket(role)) setShowCreate(true);
        }}
      />
      {showCreate && canCreateTicket(role) && (
        <CreateTicketModal onClose={() => setShowCreate(false)} />
      )}
    </AppShell>
  );
}
