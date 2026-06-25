"use client";

import { useAuthStore } from "@/stores/auth.store";
import { createClient } from "@/services/supabase/client";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

export function useAuth() {
  const { user, isAuthenticated, isLoading, logout: clearAuth } = useAuthStore();
  const router = useRouter();
  const supabase = createClient();

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    clearAuth();
    router.push("/login");
  }, [supabase, clearAuth, router]);

  return {
    user,
    isAuthenticated,
    isLoading,
    logout,
  };
}
