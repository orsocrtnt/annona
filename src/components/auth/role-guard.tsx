"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { getRoleHomePath } from "@/lib/permissions/page-access";
import type { SystemRole } from "@prisma/client";

interface RoleGuardProps {
  role: SystemRole;
  loginHref: string;
  children: ReactNode;
}

/**
 * Garde le cadre (header/nav) visible. Loader seulement dans la zone contenu,
 * et uniquement tant que la session n'est pas encore résolue.
 */
export function RoleGuard({ role, loginHref, children }: RoleGuardProps) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated || !user) {
      router.replace(loginHref);
      return;
    }

    if (user.role.systemRole !== role) {
      router.replace(getRoleHomePath(user.role.systemRole));
    }
  }, [user, isLoading, isAuthenticated, router, role, loginHref]);

  if (user?.role.systemRole === role) {
    return <>{children}</>;
  }

  if (isLoading) {
    return <PageSkeleton />;
  }

  return null;
}
