"use client";

import { useAuthStore } from "@/stores/auth.store";
import { canOpenPage } from "@/lib/permissions/page-access";

/** Masque un lien que la garde serveur (AUTH-ROLE) refuserait : même table, données de session. */
export function useCanOpenPage(href: string): boolean {
  const user = useAuthStore((state) => state.user);
  const permissions = useAuthStore((state) => state.permissions);
  if (!user) return false;
  return canOpenPage(href, { role: user.role.systemRole, permissions, settings: user.settings });
}
