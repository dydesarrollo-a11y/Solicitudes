"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { signOut } from "@/lib/firebase/auth";
import { canAccessAdminPanel } from "@/lib/business/permissions";
import { ROLE_LABEL } from "@/lib/business/constants";
import { NotificationBell } from "./NotificationBell";
import { useState } from "react";

export function Header() {
  const { profile, role } = useAuth();
  const { theme, toggle } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const [menu, setMenu] = useState(false);

  const navLink = (href: string, label: string) => (
    <Link
      href={href}
      className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
        pathname?.startsWith(href)
          ? "bg-brand-yellow text-brand-black"
          : "hover:bg-black/5 dark:hover:bg-white/10"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-4 px-4 sm:px-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-yellow font-black text-brand-black">
            S
          </span>
          <span className="text-lg font-black tracking-tight">Solicitudes</span>
        </Link>

        <nav className="ml-4 flex items-center gap-1">
          {navLink("/dashboard", "Tablero")}
          {canAccessAdminPanel(role) && navLink("/admin", "Admin")}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <button
            aria-label="Cambiar tema"
            onClick={toggle}
            className="rounded-full p-2 hover:bg-black/5 dark:hover:bg-white/10"
          >
            {theme === "dark" ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>

          <NotificationBell />

          <div className="relative">
            <button
              onClick={() => setMenu((m) => !m)}
              className="flex items-center gap-2 rounded-full p-1 pr-2 hover:bg-black/5 dark:hover:bg-white/10"
            >
              {profile?.photoURL ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.photoURL} alt="" className="h-8 w-8 rounded-full" />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-black text-xs font-bold text-white">
                  {(profile?.displayName ?? "?").slice(0, 1).toUpperCase()}
                </span>
              )}
            </button>
            {menu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenu(false)} />
                <div className="card-surface absolute right-0 z-40 mt-2 w-56 rounded-xl p-2 shadow-cardHover">
                  <div className="px-2 py-2">
                    <p className="truncate text-sm font-semibold">{profile?.displayName}</p>
                    <p className="truncate text-xs text-[var(--muted)]">{profile?.email}</p>
                    {role && (
                      <span className="chip mt-2 bg-brand-yellow/30 text-[var(--text)]">
                        {ROLE_LABEL[role]}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={async () => {
                      await signOut();
                      router.push("/login");
                    }}
                    className="mt-1 w-full rounded-lg px-2 py-2 text-left text-sm font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    Cerrar sesión
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
