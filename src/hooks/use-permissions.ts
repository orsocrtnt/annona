"use client";

import { useAuthStore } from "@/stores/auth.store";
import { hasPermission, hasAllPermissions, hasRole, hasMinimumRole } from "@/lib/permissions/rbac";
import type { SystemRole } from "@prisma/client";
import type { PermissionSlug } from "@/lib/permissions/rbac";
import { miniAdminModules } from "@/lib/permissions/mini-admin";

export function usePermissions() {
  const permissions = useAuthStore((s) => s.permissions);
  const user = useAuthStore((s) => s.user);

  return {
    permissions,
    role: user?.role.systemRole,
    /** Lot 1, demande 4 : fonctionnalités d'un mini admin ; `null` = accès complet du rôle. */
    modules: user ? miniAdminModules(user) : null,
    /** Administrateur de l'entreprise sans restriction (gère les comptes administrateur et mini admin). */
    isFullAdmin: user?.role.systemRole === "ADMIN" && miniAdminModules(user) === null,
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
