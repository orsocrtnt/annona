import type { SystemRole } from "@prisma/client";
import { getPageAccessRule } from "./page-access";

export const RESOURCES = [
  "users",
  "companies",
  "merchants",
  "catalog",
  "orders",
  "production",
  "rounds",
  "stops",
  "invoices",
  "settings",
  "support",
  "dashboard",
  // Lot 1, demandes 2 et 4 : promotions et suivi des livreurs, fonctionnalités séparées.
  "promotions",
  "tracking",
] as const;

export type Resource = (typeof RESOURCES)[number];

export const ACTIONS = [
  "read",
  "create",
  "update",
  "delete",
  "manage",
  "admin",
  "company",
  "baker",
  "driver",
  "merchant",
] as const;

export type Action = (typeof ACTIONS)[number];

export type PermissionSlug = `${Resource}:${Action}`;

export const ROLE_HIERARCHY: Record<SystemRole, number> = {
  SUPER_ADMIN: 100,
  ADMIN: 80,
  BAKER: 50,
  DRIVER: 40,
  MERCHANT: 20,
};

export const ROLE_LABELS: Record<SystemRole, string> = {
  SUPER_ADMIN: "Super-administrateur",
  ADMIN: "Administrateur",
  BAKER: "Boulanger",
  DRIVER: "Livreur",
  MERCHANT: "Client",
};

/** Personnel de l'entreprise qui gère le back-office (hors boulanger, livreur et client). */
export const STAFF_ROLES: SystemRole[] = ["SUPER_ADMIN", "ADMIN"];

export function hasPermission(
  userPermissions: string[],
  required: PermissionSlug | PermissionSlug[]
): boolean {
  const requiredList = Array.isArray(required) ? required : [required];
  return requiredList.some((perm) => userPermissions.includes(perm));
}

export function hasAllPermissions(
  userPermissions: string[],
  required: PermissionSlug[]
): boolean {
  return required.every((perm) => userPermissions.includes(perm));
}

export function hasRole(userRole: SystemRole, allowedRoles: SystemRole[]): boolean {
  return allowedRoles.includes(userRole);
}

export function hasMinimumRole(userRole: SystemRole, minimumRole: SystemRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minimumRole];
}

/** Rôles admis par la page (table unique : `page-access.ts`). */
export function getAllowedRolesForPath(path: string): SystemRole[] {
  return [...(getPageAccessRule(path)?.roles ?? [])];
}

export function buildPermissionSlug(resource: Resource, action: Action): PermissionSlug {
  return `${resource}:${action}`;
}
