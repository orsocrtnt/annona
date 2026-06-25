"use client";

import { useAuthStore } from "@/stores/auth.store";
import { hasPermission, hasAllPermissions, hasRole, hasMinimumRole } from "@/lib/permissions/rbac";
import type { SystemRole } from "@prisma/client";
import type { PermissionSlug } from "@/lib/permissions/rbac";

export function usePermissions() {
  const permissions = useAuthStore((s) => s.permissions);
  const user = useAuthStore((s) => s.user);

  return {
    permissions,
    role: user?.role.systemRole,
    can: (required: PermissionSlug | PermissionSlug[]) =>
      hasPermission(permissions, required),
    canAll: (required: PermissionSlug[]) =>
      hasAllPermissions(permissions, required),
    isRole: (roles: SystemRole[]) =>
      user ? hasRole(user.role.systemRole, roles) : false,
    hasMinimumRole: (minimum: SystemRole) =>
      user ? hasMinimumRole(user.role.systemRole, minimum) : false,
  };
}
