"use client";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/config";
import type { AppUser, Role, UserStatus } from "@/lib/types";

interface AuthContextValue {
  firebaseUser: User | null;
  profile: AppUser | null;
  role: Role | null;
  status: UserStatus | null;
  loading: boolean;
  isActive: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  firebaseUser: null,
  profile: null,
  role: null,
  status: null,
  loading: true,
  isActive: false
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setFirebaseUser(u);
      if (!u) {
        setProfile(null);
        setLoading(false);
      }
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;
    // Refrescar token para tener los custom claims más recientes.
    firebaseUser.getIdToken(true).catch(() => undefined);

    const unsub = onSnapshot(
      doc(db, "users", firebaseUser.uid),
      (snap) => {
        setProfile(snap.exists() ? (snap.data() as AppUser) : null);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [firebaseUser]);

  const value = useMemo<AuthContextValue>(() => {
    const role = profile?.role ?? null;
    const status = profile?.status ?? null;
    return {
      firebaseUser,
      profile,
      role,
      status,
      loading,
      isActive: status === "active" && !!role
    };
  }, [firebaseUser, profile, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
