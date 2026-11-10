"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth.store";
import { canOpenPage, getHomePath } from "@/lib/permissions/page-access";
import { miniAdminModules } from "@/lib/permissions/mini-admin";
import type { UserWithRole } from "@/types";

const MINI_ADMIN_REFRESH_MS = 30_000;

async function fetchAccess(): Promise<{ user: UserWithRole | null; permissions: string[] }> {
  const res = await fetch("/api/auth/session", { cache: "no-store" });
  if (!res.ok) throw new Error("Session fetch failed");
  return res.json();
}

/**
 * Lot 1, demande 4 : les fonctionnalités d'un administrateur peuvent changer pendant sa session.
 * Le serveur les relit à chaque requête ; ici le menu suit : droits relus à chaque changement de page,
 * au retour sur l'onglet et, pour un mini admin, toutes les 30 secondes. Une page qui n'est plus
 * accordée est quittée pour l'accueil du compte.
 */
export function useAccessRefresh() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role.systemRole === "ADMIN";
  const isMiniAdmin = Boolean(user && miniAdminModules(user));

  const query = useQuery({
    queryKey: ["session", "access", pathname],
    queryFn: fetchAccess,
    enabled: isAdmin,
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: true,
    refetchInterval: isMiniAdmin ? MINI_ADMIN_REFRESH_MS : false,
  });

  useEffect(() => {
    const fresh = query.data;
    if (!fresh?.user) return;
    const state = useAuthStore.getState();
    const changed =
      JSON.stringify(fresh.permissions) !== JSON.stringify(state.permissions) ||
      JSON.stringify(miniAdminModules(fresh.user)) !== JSON.stringify(state.user ? miniAdminModules(state.user) : null) ||
      fresh.user.role.systemRole !== state.user?.role.systemRole;
    if (!changed) return;
    state.setPermissions(fresh.permissions ?? []);
    state.setUser(fresh.user);
    const subject = { role: fresh.user.role.systemRole, permissions: fresh.permissions ?? [], modules: miniAdminModules(fresh.user) };
    if (!canOpenPage(pathname, subject)) router.replace(getHomePath(subject));
  }, [query.data, pathname, router]);
}
