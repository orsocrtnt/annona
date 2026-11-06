"use client";

import { useQueryClient } from "@tanstack/react-query";
import { selectLoginRedirect } from "@/lib/auth/login-redirect";
import { browserStorage, rememberLastSpace } from "@/features/auth/login-space";
import { DEMO_LOGIN_EMAIL } from "@/lib/demo/constants";
import { useAuthStore } from "@/stores/auth.store";
import type { JsonResult } from "@/features/auth/request-timeout";

const DEMO_REQUEST_KEY_STORAGE = "annona-demo-request-key";

/**
 * Clé de réservation de la démo, stable pour l'onglet : un double envoi (double clic, montage React répété)
 * reprend le même espace au lieu d'en réserver deux. `undefined` pour tout autre compte.
 */
export function demoRequestKeyFor(normalizedEmail: string): string | undefined {
  if (normalizedEmail !== DEMO_LOGIN_EMAIL) return undefined;
  const key = window.sessionStorage.getItem(DEMO_REQUEST_KEY_STORAGE) ?? window.crypto.randomUUID();
  window.sessionStorage.setItem(DEMO_REQUEST_KEY_STORAGE, key);
  return key;
}

/**
 * Après une réponse 200 de `/api/auth/login` : remplit la session côté client et renvoie l'espace à ouvrir.
 * Le serveur a déjà choisi cet espace d'après le rôle relu en base (super admin, admin, client, livreur).
 */
export function useApplyLoginSession() {
  const queryClient = useQueryClient();
  const { setUser, setPermissions, setDemo, setSaas } = useAuthStore();

  return async (json: JsonResult["json"], requestedRedirect: string | null): Promise<string> => {
    await queryClient.clear();
    setSaas(json.saas ?? null);
    setPermissions(json.permissions);
    setDemo(json.demo ?? null);
    setUser(json.user);
    queryClient.setQueryData(["session"], {
      user: json.user,
      permissions: json.permissions,
      demo: json.demo ?? null,
      saas: json.saas ?? null,
    });
    const destination = selectLoginRedirect(requestedRedirect, json.redirectTo);
    // Repère « Dernier utilisé » : l'espace ouvert par le serveur, sans aucune donnée personnelle.
    rememberLastSpace(browserStorage(), destination);
    return destination;
  };
}
