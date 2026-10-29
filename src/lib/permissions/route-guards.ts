import type { SystemRole } from "@prisma/client";
import {
  PAGE_ACCESS_RULES,
  getPageAccessRule,
  getRoleHomePath,
  isProtectedPagePath,
  ruleAllowsRoleAndPermissions,
} from "./page-access";

/** Vue « garde de route » de la table unique `page-access.ts` (aucune règle propre). */
export interface RouteGuardConfig {
  path: string;
  allowedRoles: SystemRole[];
  requiredPermissions?: string[];
  redirectTo?: string;
}

export const ROUTE_GUARDS: RouteGuardConfig[] = PAGE_ACCESS_RULES.map((rule) => ({
  path: rule.path,
  allowedRoles: [...rule.roles],
  ...(rule.anyPermission ? { requiredPermissions: [...rule.anyPermission] } : {}),
  redirectTo: "/login",
}));

export function getRouteGuard(pathname: string): RouteGuardConfig | null {
  const rule = getPageAccessRule(pathname);
  return rule ? (ROUTE_GUARDS.find((guard) => guard.path === rule.path) ?? null) : null;
}

/**
 * Rôle + permission (déjà filtrées par modules pour le mini-admin). La garde serveur
 * complète utilise `evaluatePageAccess`, qui contrôle aussi les modules mini-admin.
 */
export function isRouteAllowed(
  pathname: string,
  userRole: SystemRole,
  userPermissions: string[]
): { allowed: boolean; redirectTo?: string } {
  if (!isProtectedPagePath(pathname)) return { allowed: true };
  const rule = getPageAccessRule(pathname);
  if (rule && ruleAllowsRoleAndPermissions(rule, userRole, userPermissions)) {
    return { allowed: true };
  }
  return { allowed: false, redirectTo: "/login" };
}

export function getDashboardForRole(role: SystemRole): string {
  return getRoleHomePath(role);
}
