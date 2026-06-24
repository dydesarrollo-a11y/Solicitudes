"use client";
import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { callAssignRole, callSetUserStatus } from "@/lib/firebase/services";
import { ROLE_LABEL } from "@/lib/business/constants";
import { useAuth } from "@/hooks/useAuth";
import type { AppUser, Role, UserStatus } from "@/lib/types";
import { Spinner, ErrorState } from "@/components/ui/States";

const ROLES: Role[] = ["superadmin", "admin", "requester", "technician", "auditor"];

const STATUS_STYLE: Record<UserStatus, string> = {
  active: "bg-green-100 text-green-700",
  pending: "bg-amber-100 text-amber-700",
  disabled: "bg-red-100 text-red-700"
};

export function UsersPanel() {
  const { role: myRole } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setUsers(snap.docs.map((d) => d.data() as AppUser));
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const isSuper = myRole === "superadmin";

  async function changeRole(uid: string, newRole: Role) {
    setBusy(uid);
    setError(null);
    try {
      await callAssignRole({ uid, role: newRole });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al asignar rol.");
    } finally {
      setBusy(null);
    }
  }
  async function changeStatus(uid: string, status: UserStatus) {
    setBusy(uid);
    setError(null);
    try {
      await callSetUserStatus({ uid, status });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cambiar estado.");
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <Spinner label="Cargando usuarios…" />;

  return (
    <div className="space-y-3">
      {error && <ErrorState message={error} />}
      {!isSuper && (
        <p className="text-sm text-[var(--muted)]">
          Solo un SuperAdmin puede asignar roles o cambiar estados.
        </p>
      )}
      <div className="card-surface overflow-x-auto rounded-xl">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--border)] text-left text-xs uppercase text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3">Usuario</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Rol</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.uid} className="border-b border-[var(--border)] last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium">{u.displayName}</p>
                  <p className="text-xs text-[var(--muted)]">{u.email}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`chip ${STATUS_STYLE[u.status]}`}>{u.status}</span>
                </td>
                <td className="px-4 py-3">
                  {isSuper ? (
                    <select
                      className="input w-auto"
                      value={u.role ?? ""}
                      disabled={busy === u.uid}
                      onChange={(e) => changeRole(u.uid, e.target.value as Role)}
                    >
                      <option value="" disabled>
                        Sin rol
                      </option>
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span>{u.role ? ROLE_LABEL[u.role] : "—"}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {isSuper && (
                    <div className="flex gap-2">
                      {u.status !== "active" && u.role && (
                        <button
                          className="btn-ghost px-2 py-1 text-xs"
                          disabled={busy === u.uid}
                          onClick={() => changeStatus(u.uid, "active")}
                        >
                          Activar
                        </button>
                      )}
                      {u.status !== "disabled" && (
                        <button
                          className="btn-ghost px-2 py-1 text-xs text-red-600"
                          disabled={busy === u.uid}
                          onClick={() => changeStatus(u.uid, "disabled")}
                        >
                          Desactivar
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
