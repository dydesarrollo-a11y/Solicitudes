"use client";
import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import type { Comment, HistoryEvent } from "@/lib/types";

/** Comentarios de un ticket en tiempo real. */
export function useComments(ticketId: string | null) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ticketId) return;
    const q = query(
      collection(db, "tickets", ticketId, "comments"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setComments(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Comment, "id">) }))
      );
      setLoading(false);
    });
    return () => unsub();
  }, [ticketId]);

  return { comments, loading };
}

/** Historial/auditoría de un ticket en tiempo real. */
export function useHistory(ticketId: string | null) {
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ticketId) return;
    const q = query(
      collection(db, "tickets", ticketId, "history"),
      orderBy("at", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setEvents(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<HistoryEvent, "id">) }))
      );
      setLoading(false);
    });
    return () => unsub();
  }, [ticketId]);

  return { events, loading };
}
