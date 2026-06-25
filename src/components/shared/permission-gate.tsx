"use client";

import { usePermissions } from "@/hooks/use-permissions";
import type { PermissionSlug } from "@/lib/permissions/rbac";
import type { SystemRole } from "@prisma/client";

interface PermissionGateProps {
  children: React.ReactNode;
  permissions?: PermissionSlug | PermissionSlug[];
  roles?: SystemRole[];
  fallback?: React.ReactNode;
  requireAll?: boolean;
}

export function PermissionGate({
  children,
  permissions,
  roles,
  fallback = null,
  requireAll = false,
}: PermissionGateProps) {
  const { can, canAll, isRole } = usePermissions();

  if (roles && !isRole(roles)) return <>{fallback}</>;

  if (permissions) {
    const allowed = requireAll
      ? canAll(Array.isArray(permissions) ? permissions : [permissions])
      : can(permissions);
    if (!allowed) return <>{fallback}</>;
  }

  return <>{children}</>;
}
