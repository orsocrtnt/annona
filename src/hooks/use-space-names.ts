"use client";

import { useMemo } from "react";
import { readSpaceNames, type SpaceNames } from "@/lib/company/space-names";
import { useAuthStore } from "@/stores/auth.store";

/** RETOURS-3 : noms des deux laboratoires de l'entreprise connectée (réglés par le gérant dans Paramètres). */
export function useSpaceNames(): SpaceNames {
  const settings = useAuthStore((state) => state.user?.company?.settings);
  return useMemo(() => readSpaceNames(settings), [settings]);
}

/** Après un enregistrement des Paramètres : met à jour les noms dans la session sans recharger la page. */
export function applySpaceNamesToSession(names: SpaceNames) {
  const { user, setUser } = useAuthStore.getState();
  if (!user?.company) return;
  const settings =
    user.company.settings && typeof user.company.settings === "object" && !Array.isArray(user.company.settings)
      ? (user.company.settings as Record<string, unknown>)
      : {};
  setUser({ ...user, company: { ...user.company, settings: { ...settings, spaceNames: names } } });
}
