"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";
import { getRoleHomePath } from "@/lib/permissions/page-access";
import type { SystemRole } from "@prisma/client";

interface RoleGuardProps {
  role: SystemRole;
  loginHref: string;
  children: ReactNode;
}

/**
 * Garde le cadre (header/nav) visible.
 *
 * Lot 1, D9 (décision d'Orso du 10 novembre 2026) : tant que la session du navigateur se charge, la page
 * s'affiche et lance ses requêtes sans l'attendre. Le middleware a déjà refusé côté serveur toute page
 * d'un autre rôle (`evaluatePageAccess`) et chaque API vérifie ses droits ; attendre la session ajoutait
 * un aller-retour complet à chaque ouverture. Une fois la session connue, un rôle différent ou une
 * session absente redirige comme avant, et la page n'est plus affichée.
 */
export function RoleGuard({ role, loginHref, children }: RoleGuardProps) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated || !user) {
      router.replace(loginHref);
      return;
    }

    if (user.role.systemRole !== role) {
      router.replace(getRoleHomePath(user.role.systemRole));
    }
  }, [user, isLoading, isAuthenticated, router, role, loginHref]);

  return roleGuardShowsPage({ role, isLoading, userRole: user?.role.systemRole ?? null }) ? <>{children}</> : null;
}

/** Affiche la page : session du bon rôle, ou session encore en chargement (le serveur a déjà vérifié le rôle). */
export function roleGuardShowsPage({ role, isLoading, userRole }: { role: SystemRole; isLoading: boolean; userRole: SystemRole | null }) {
  if (userRole) return userRole === role;
  return isLoading;
}
