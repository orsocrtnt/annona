"use client";

import { useAuthStore } from "@/stores/auth.store";
import { createClient } from "@/services/supabase/client";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { releaseDeviceOnLogout } from "@/lib/native/device-logout";
import { releaseDemoOnLogout } from "@/lib/demo/demo-logout";
import { clearPendingCredentials } from "@/lib/storage/pending-credentials";

export function useAuth() {
  const { user, isAuthenticated, isLoading, logout: clearAuth } = useAuthStore();
  const router = useRouter();
  const supabase = createClient();
  const queryClient = useQueryClient();

  const logout = useCallback(async () => {
    // MOBILE-1 : avant la fin de session (le retrait du jeton natif est authentifié).
    await releaseDeviceOnLogout();
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Déconnexion impossible. Vérifiez votre connexion et réessayez.");
      return;
    }
    // DEMO-1 : se déconnecter d'une démo la rend aussitôt (sans effet pour un vrai compte). Attendu avant la
    // redirection, pour qu'une nouvelle démo ouverte dans la foulée ne retrouve pas l'ancien prêt ; avant le
    // nettoyage local (recette du 23 novembre : vider le compte d'abord empêche la redirection).
    await releaseDemoOnLogout(user);
    clearAuth();
    clearPendingCredentials();
    queryClient.clear();
    router.push("/login");
  }, [supabase, user, clearAuth, queryClient, router]);

  return {
    user,
    isAuthenticated,
    isLoading,
    logout,
  };
}
