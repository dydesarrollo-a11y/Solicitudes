"use client";
import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { signOut } from "@/lib/firebase/auth";
import { Header } from "./Header";
import { Spinner } from "./ui/States";

/**
 * Envuelve páginas protegidas: gestiona sesión, estados pendiente/desactivado
 * y muestra el encabezado estático. `requireRoles` restringe el acceso.
 */
export function AppShell({
  children,
  requireRoles
}: {
  children: ReactNode;
  requireRoles?: string[];
}) {
  const { firebaseUser, profile, role, status, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !firebaseUser) router.replace("/login");
  }, [loading, firebaseUser, router]);

  if (loading) return <Spinner label="Cargando…" />;
  if (!firebaseUser) return <Spinner label="Redirigiendo…" />;

  // Usuario sin perfil aún o pendiente de autorización.
  if (!profile || status === "pending" || !role) {
    return <PendingScreen onSignOut={() => signOut().then(() => router.push("/login"))} />;
  }
  if (status === "disabled") {
    return (
      <CenteredCard title="Cuenta desactivada">
        Tu acceso fue desactivado. Contacta a un SuperAdmin.
        <button className="btn-ghost mt-4" onClick={() => signOut().then(() => router.push("/login"))}>
          Cerrar sesión
        </button>
      </CenteredCard>
    );
  }

  if (requireRoles && !requireRoles.includes(role)) {
    return (
      <>
        <Header />
        <CenteredCard title="Sin permisos">
          No tienes permisos para ver esta sección.
        </CenteredCard>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">{children}</main>
    </>
  );
}

function PendingScreen({ onSignOut }: { onSignOut: () => void }) {
  return (
    <CenteredCard title="Cuenta pendiente de autorización">
      Tu cuenta del dominio fue registrada. Un SuperAdmin debe asignarte un rol
      antes de que puedas usar el sistema.
      <button className="btn-ghost mt-4" onClick={onSignOut}>
        Cerrar sesión
      </button>
    </CenteredCard>
  );
}

function CenteredCard({
  title,
  children
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="card-surface max-w-md rounded-2xl p-8 text-center shadow-card">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-yellow font-black text-brand-black">
          S
        </div>
        <h1 className="mb-2 text-xl font-bold">{title}</h1>
        <div className="text-sm text-[var(--muted)]">{children}</div>
      </div>
    </div>
  );
}
