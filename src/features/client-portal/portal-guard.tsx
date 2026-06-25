"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";
import { PageLoader } from "@/components/ui/loader";
import { ROLE_DASHBOARD_MAP } from "@/lib/constants";

export function PortalGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isLoading, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated || !user) {
      router.replace("/login/client");
      return;
    }

    if (user.role.systemRole !== "CLIENT") {
      router.replace(ROLE_DASHBOARD_MAP[user.role.systemRole]);
    }
  }, [user, isLoading, isAuthenticated, router]);

  if (user?.role.systemRole === "CLIENT") {
    return <>{children}</>;
  }

  if (isLoading || !user) {
    return <PageLoader label="Chargement de votre espace..." />;
  }

  return <PageLoader label="Chargement de votre espace..." />;
}
