"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { TicketDetail } from "@/components/ticket/TicketDetail";
import { Spinner, ErrorState } from "@/components/ui/States";

/**
 * Ruta de ticket compatible con export estático (GitHub Pages):
 * el id viaja como query param  ->  /ticket?id=SOL-2026-0001
 */
function TicketView() {
  const params = useSearchParams();
  const id = params.get("id");
  if (!id) return <ErrorState message="Falta el identificador del ticket." />;
  return <TicketDetail ticketId={id} />;
}

export default function TicketPage() {
  return (
    <AppShell>
      <Suspense fallback={<Spinner label="Cargando ticket…" />}>
        <TicketView />
      </Suspense>
    </AppShell>
  );
}
