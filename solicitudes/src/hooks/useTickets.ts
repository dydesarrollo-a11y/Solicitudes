"use client";
import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  type Query,
  doc
} from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "./useAuth";
import type { Role, Ticket } from "@/lib/types";

/**
 * Suscripción en tiempo real a los tickets visibles según el rol.
 * Las Rules son la barrera real; aquí limitamos la query para eficiencia.
 */
export function useTickets(includeClosed = false) {
  const { firebaseUser, role, isActive } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseUser || !isActive || !role) {
      setTickets([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const base = collection(db, "tickets");
    let q: Query;

    const r = role as Role;
    if (r === "requester") {
      q = query(base, where("createdBy", "==", firebaseUser.uid), orderBy("createdAt", "desc"));
    } else if (r === "technician") {
      // Técnicos: etapas técnicas (matching/sample/report).
      q = query(
        base,
        where("status", "in", ["matching", "sample", "report"]),
        orderBy("createdAt", "desc")
      );
    } else {
      // admin / superadmin / auditor: todo.
      q = query(base, orderBy("createdAt", "desc"));
    }

    const unsub = onSnapshot(
      q,
      (snap) => {
        let rows = snap.docs.map((d) => d.data() as Ticket);
        if (!includeClosed) rows = rows.filter((t) => !t.isClosed);
        setTickets(rows);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [firebaseUser, role, isActive, includeClosed]);

  return { tickets, loading, error };
}

/** Suscripción a un ticket individual. */
export function useTicket(ticketId: string | null) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ticketId) {
      setTicket(null);
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(
      doc(db, "tickets", ticketId),
      (snap) => {
        setTicket(snap.exists() ? (snap.data() as Ticket) : null);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [ticketId]);

  return { ticket, loading, error };
}
