import type { SystemRole } from "@prisma/client";
import { getAllowedRolesForPath } from "./rbac";

export interface RouteGuardConfig {
  path: string;
  allowedRoles: SystemRole[];
  requiredPermissions?: string[];
  redirectTo?: string;
}

export const ROUTE_GUARDS: RouteGuardConfig[] = [
  {
    path: "/admin",
    allowedRoles: ["SUPER_ADMIN"],
    requiredPermissions: ["dashboard:admin"],
    redirectTo: "/login",
  },
  {
    path: "/dashboard",
    allowedRoles: ["SUPER_ADMIN", "COMPANY_ADMIN", "MINI_ADMIN"],
    requiredPermissions: ["dashboard:company"],
    redirectTo: "/login",
  },
  {
    path: "/dispatch",
    allowedRoles: ["SUPER_ADMIN", "COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER"],
    requiredPermissions: ["dashboard:dispatcher"],
    redirectTo: "/login",
  },
  {
    path: "/driver",
    allowedRoles: ["DRIVER"],
    requiredPermissions: ["dashboard:driver"],
    redirectTo: "/login",
  },
  {
    path: "/portal",
    allowedRoles: ["CLIENT"],
    requiredPermissions: ["dashboard:client"],
    redirectTo: "/login",
  },
  {
    path: "/settings",
    allowedRoles: ["SUPER_ADMIN", "COMPANY_ADMIN", "MINI_ADMIN"],
    requiredPermissions: ["settings:read"],
    redirectTo: "/login",
  },
  {
    path: "/users",
    allowedRoles: ["SUPER_ADMIN", "COMPANY_ADMIN", "MINI_ADMIN"],
    requiredPermissions: ["users:read"],
    redirectTo: "/login",
  },
  {
    path: "/companies",
    allowedRoles: ["SUPER_ADMIN"],
    requiredPermissions: ["companies:read"],
    redirectTo: "/login",
  },
];

export function getRouteGuard(pathname: string): RouteGuardConfig | null {
  const sorted = [...ROUTE_GUARDS].sort((a, b) => b.path.length - a.path.length);
  return sorted.find((guard) => pathname.startsWith(guard.path)) ?? null;
}

export function isRouteAllowed(
  pathname: string,
  userRole: SystemRole,
  userPermissions: string[]
): { allowed: boolean; redirectTo?: string } {
  const guard = getRouteGuard(pathname);

  if (!guard) {
    const allowedRoles = getAllowedRolesForPath(pathname);
    if (allowedRoles.length === 0) return { allowed: true };
    return {
      allowed: allowedRoles.includes(userRole),
      redirectTo: "/login",
    };
  }

  if (!guard.allowedRoles.includes(userRole)) {
    return { allowed: false, redirectTo: guard.redirectTo ?? "/login" };
  }

  if (guard.requiredPermissions) {
    const hasAll = guard.requiredPermissions.every((p) =>
      userPermissions.includes(p)
    );
    if (!hasAll) {
      return { allowed: false, redirectTo: guard.redirectTo ?? "/login" };
    }
  }

  return { allowed: true };
}

export function getDashboardForRole(role: SystemRole): string {
  const map: Record<SystemRole, string> = {
    SUPER_ADMIN: "/admin",
    COMPANY_ADMIN: "/dashboard",
    MINI_ADMIN: "/dashboard",
    DISPATCHER: "/dispatch",
    DRIVER: "/driver",
    CLIENT: "/portal",
  };
  return map[role];
}
