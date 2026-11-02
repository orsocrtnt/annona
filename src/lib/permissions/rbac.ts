import type { SystemRole } from "@prisma/client";
import { getPageAccessRule } from "./page-access";

export const RESOURCES = [
  "users",
  "companies",
  "deliveries",
  "orders",
  "drivers",
  "vehicles",
  "analytics",
  "settings",
  "dashboard",
  "invoices",
  "support",
] as const;

export type Resource = (typeof RESOURCES)[number];

export const ACTIONS = [
  "read",
  "create",
  "update",
  "delete",
  "manage",
  "dispatch",
  "admin",
  "company",
  "dispatcher",
  "driver",
  "client",
] as const;

export type Action = (typeof ACTIONS)[number];

export type PermissionSlug = `${Resource}:${Action}`;

export const ROLE_HIERARCHY: Record<SystemRole, number> = {
  SUPER_ADMIN: 100,
  COMPANY_ADMIN: 80,
  MINI_ADMIN: 70,
  DISPATCHER: 60,
  DRIVER: 40,
  CLIENT: 20,
};

export const ROLE_LABELS: Record<SystemRole, string> = {
  SUPER_ADMIN: "Super Admin",
  COMPANY_ADMIN: "Administrateur",
  MINI_ADMIN: "Mini-admin",
  DISPATCHER: "Dispatcher",
  DRIVER: "Livreur",
  CLIENT: "Client",
};

/** Personnel interne (back-office), hors client et livreur. */
export const STAFF_ROLES: SystemRole[] = [
  "SUPER_ADMIN",
  "COMPANY_ADMIN",
  "MINI_ADMIN",
  "DISPATCHER",
];

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
