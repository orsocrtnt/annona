"use client";

import { useQueryClient } from "@tanstack/react-query";
import { selectLoginRedirect } from "@/lib/auth/login-redirect";
import { browserStorage, rememberLastSpace } from "@/features/auth/login-space";
import { useAuthStore } from "@/stores/auth.store";
import type { JsonResult } from "@/features/auth/request-timeout";

/**
 * Après une réponse 200 de `/api/auth/login` : remplit la session côté client et renvoie l'espace à ouvrir.
 * Le serveur a déjà choisi cet espace d'après le rôle relu en base (super admin, admin, client, livreur).
 */
export function useApplyLoginSession() {
  const queryClient = useQueryClient();
  const { setUser, setPermissions } = useAuthStore();

  return async (json: JsonResult["json"], requestedRedirect: string | null): Promise<string> => {
    await queryClient.clear();
    setPermissions(json.permissions);
    setUser(json.user);
    queryClient.setQueryData(["session"], {
      user: json.user,
      permissions: json.permissions,
    });
    const destination = selectLoginRedirect(requestedRedirect, json.redirectTo);
    // Repère « Dernier utilisé » : l'espace ouvert par le serveur, sans aucune donnée personnelle.
    rememberLastSpace(browserStorage(), destination);
    return destination;
  };
}
