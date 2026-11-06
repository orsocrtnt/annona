import { create } from "zustand";
import type { UserWithRole } from "@/types";

interface AuthState {
  user: UserWithRole | null;
  permissions: string[];
  isLoading: boolean;
  isAuthenticated: boolean;
  setUser: (user: UserWithRole | null) => void;
  setPermissions: (permissions: string[]) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  permissions: [],
  isLoading: true,
  isAuthenticated: false,
  setUser: (user) =>
    set({ user, isAuthenticated: !!user, isLoading: false }),
  setPermissions: (permissions) => set({ permissions }),
  setLoading: (isLoading) => set({ isLoading }),
  logout: () =>
    set({
      user: null,
      permissions: [],
      isAuthenticated: false,
      isLoading: false,
    }),
}));
