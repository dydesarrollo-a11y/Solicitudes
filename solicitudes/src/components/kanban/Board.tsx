"use client";
import { useMemo, useState } from "react";
import { useTickets } from "@/hooks/useTickets";
import { BOARD_COLUMNS, PRIORITY_ORDER } from "@/lib/business/constants";
import type { Priority, TimeStatus } from "@/lib/types";
import { TicketCard } from "./TicketCard";
import { Spinner, EmptyState, ErrorState } from "@/components/ui/States";

interface Filters {
  requester: string;
  priority: Priority | "all";
  timeStatus: TimeStatus | "all";
  pendingConfirm: boolean;
  search: string;
}

const EMPTY: Filters = {
  requester: "all",
  priority: "all",
  timeStatus: "all",
  pendingConfirm: false,
  search: ""
};

export function Board({ onCreate }: { onCreate: () => void }) {
  const [showClosed, setShowClosed] = useState(false);
  const { tickets, loading, error } = useTickets(showClosed);
  const [filters, setFilters] = useState<Filters>(EMPTY);

  const requesters = useMemo(
    () => Array.from(new Set(tickets.map((t) => t.requesterName))).sort(),
    [tickets]
  );

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return tickets
      .filter((t) => (showClosed ? true : !t.isClosed))
      .filter((t) => filters.requester === "all" || t.requesterName === filters.requester)
      .filter((t) => filters.priority === "all" || t.priority === filters.priority)
      .filter((t) => filters.timeStatus === "all" || t.timeStatus === filters.timeStatus)
      .filter(
        (t) =>
          !filters.pendingConfirm ||
          t.deliveryConfirmationStatus === "pending_confirmation"
      )
      .filter(
        (t) =>
          !q ||
          t.ticketId.toLowerCase().includes(q) ||
          t.clientOrProject.toLowerCase().includes(q) ||
          t.specification.toLowerCase().includes(q)
      )
      .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
  }, [tickets, filters, showClosed]);

  const byColumn = (status: string) => filtered.filter((t) => t.status === status);
  const closedTickets = filtered.filter((t) => t.isClosed);

  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-4">
      {/* Barra de filtros */}
      <div className="card-surface flex flex-wrap items-center gap-2 rounded-xl p-3">
        <input
          placeholder="Buscar por folio, cliente o especificación…"
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          className="input max-w-xs flex-1"
        />
        <select
          className="input w-auto"
          value={filters.requester}
          onChange={(e) => setFilters((f) => ({ ...f, requester: e.target.value }))}
        >
          <option value="all">Todos los solicitantes</option>
          {requesters.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select
          className="input w-auto"
          value={filters.priority}
          onChange={(e) =>
            setFilters((f) => ({ ...f, priority: e.target.value as Priority | "all" }))
          }
        >
          <option value="all">Toda prioridad</option>
          <option value="urgent">Urgente</option>
          <option value="high">Alta</option>
          <option value="normal">Normal</option>
          <option value="low">Baja</option>
        </select>
        <select
          className="input w-auto"
          value={filters.timeStatus}
          onChange={(e) =>
            setFilters((f) => ({ ...f, timeStatus: e.target.value as TimeStatus | "all" }))
          }
        >
          <option value="all">Todo estado de tiempo</option>
          <option value="on_time">En tiempo</option>
          <option value="warning">Por vencer</option>
          <option value="late">Fuera de tiempo</option>
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={filters.pendingConfirm}
            onChange={(e) =>
              setFilters((f) => ({ ...f, pendingConfirm: e.target.checked }))
            }
          />
          Pend. confirmación
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showClosed}
            onChange={(e) => setShowClosed(e.target.checked)}
          />
          Ver cerrados
        </label>
        <button onClick={onCreate} className="btn-primary ml-auto">
          + Agregar ticket
        </button>
      </div>

      {loading ? (
        <Spinner label="Cargando tickets…" />
      ) : (
        <div className="board-scroll flex gap-4 overflow-x-auto pb-4">
          {BOARD_COLUMNS.map((col) => {
            const items = byColumn(col.status);
            return (
              <div key={col.status} className="flex w-72 flex-shrink-0 flex-col">
                <div className="mb-2 flex items-center justify-between px-1">
                  <h2 className="text-sm font-bold">{col.label}</h2>
                  <span className="chip bg-black/5 text-[var(--muted)] dark:bg-white/10">
                    {items.length}
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-2 rounded-xl bg-black/[0.02] p-2 dark:bg-white/[0.03]">
                  {items.length === 0 ? (
                    <p className="px-2 py-6 text-center text-xs text-[var(--muted)]">
                      Sin tickets
                    </p>
                  ) : (
                    items.map((t) => <TicketCard key={t.ticketId} ticket={t} />)
                  )}
                </div>
              </div>
            );
          })}

          {showClosed && (
            <div className="flex w-72 flex-shrink-0 flex-col">
              <div className="mb-2 flex items-center justify-between px-1">
                <h2 className="text-sm font-bold">Cerrados</h2>
                <span className="chip bg-black/5 text-[var(--muted)] dark:bg-white/10">
                  {closedTickets.length}
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-2 rounded-xl bg-black/[0.02] p-2 dark:bg-white/[0.03]">
                {closedTickets.length === 0 ? (
                  <p className="px-2 py-6 text-center text-xs text-[var(--muted)]">
                    Sin cerrados
                  </p>
                ) : (
                  closedTickets.map((t) => <TicketCard key={t.ticketId} ticket={t} />)
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <EmptyState
          title="No hay tickets que coincidan"
          description="Ajusta los filtros o crea una nueva solicitud."
          action={
            <button onClick={onCreate} className="btn-primary mt-2">
              + Agregar ticket
            </button>
          }
        />
      )}
    </div>
  );
}
