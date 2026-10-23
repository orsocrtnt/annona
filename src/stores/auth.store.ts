import { create } from "zustand";
import type { UserWithRole } from "@/types";
import type { DemoPersona } from "@/lib/demo/constants";
import type { SessionSaasAccess } from "@/domains/saas/saas-access";

export interface DemoSessionInfo {
  isDemo: true;
  persona: DemoPersona;
  loginEmail: string;
}

interface AuthState {
  user: UserWithRole | null;
  permissions: string[];
  demo: DemoSessionInfo | null;
  saas: SessionSaasAccess | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setUser: (user: UserWithRole | null) => void;
  setPermissions: (permissions: string[]) => void;
  setDemo: (demo: DemoSessionInfo | null) => void;
  setSaas: (saas: SessionSaasAccess | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  permissions: [],
  demo: null,
  saas: null,
  isLoading: true,
  isAuthenticated: false,
  setUser: (user) =>
    set({ user, isAuthenticated: !!user, isLoading: false }),
  setPermissions: (permissions) => set({ permissions }),
  setDemo: (demo) => set({ demo }),
  setSaas: (saas) => set({ saas }),
  setLoading: (isLoading) => set({ isLoading }),
  logout: () =>
    set({
      user: null,
      permissions: [],
      demo: null,
      saas: null,
      isAuthenticated: false,
      isLoading: false,
    }),
}));
