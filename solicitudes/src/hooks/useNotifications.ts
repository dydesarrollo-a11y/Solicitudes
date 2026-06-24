"use client";
import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  or
} from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "./useAuth";
import type { AppNotification } from "@/lib/types";

/**
 * Notificaciones del usuario: dirigidas a su uid O a su rol (grupo técnicos).
 */
export function useNotifications() {
  const { firebaseUser, role, isActive } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseUser || !isActive || !role) {
      setItems([]);
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, "notifications"),
      or(
        where("recipientUid", "==", firebaseUser.uid),
        where("recipientRole", "==", role)
      ),
      orderBy("createdAt", "desc"),
      limit(50)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AppNotification, "id">) })));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [firebaseUser, role, isActive]);

  const unreadCount = items.filter((n) => !n.read).length;
  return { items, unreadCount, loading };
}
