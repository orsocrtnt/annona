"use client";

import { useAuthStore } from "@/stores/auth.store";
import { createClient } from "@/services/supabase/client";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { clearPendingCredentials } from "@/lib/storage/pending-credentials";

export function useAuth() {
  const { user, isAuthenticated, isLoading, logout: clearAuth } = useAuthStore();
  const router = useRouter();
  const supabase = createClient();
  const queryClient = useQueryClient();

  const logout = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Déconnexion impossible. Vérifiez votre connexion et réessayez.");
      return;
    }
    clearAuth();
    clearPendingCredentials();
    queryClient.clear();
    router.push("/login");
  }, [supabase, clearAuth, queryClient, router]);

  return {
    user,
    isAuthenticated,
    isLoading,
    logout,
  };
}
