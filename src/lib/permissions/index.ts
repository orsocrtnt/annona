import type { SystemRole } from "@prisma/client";
import { ROLE_LABELS } from "./rbac";

export const PERMISSIONS = {
  USERS_READ: "users:read",
  USERS_CREATE: "users:create",
  USERS_UPDATE: "users:update",
  USERS_DELETE: "users:delete",
  COMPANIES_READ: "companies:read",
  COMPANIES_CREATE: "companies:create",
  COMPANIES_UPDATE: "companies:update",
  COMPANIES_DELETE: "companies:delete",
  MERCHANTS_READ: "merchants:read",
  MERCHANTS_MANAGE: "merchants:manage",
  CATALOG_READ: "catalog:read",
  CATALOG_MANAGE: "catalog:manage",
  ORDERS_READ: "orders:read",
  ORDERS_CREATE: "orders:create",
  ORDERS_UPDATE: "orders:update",
  PRODUCTION_READ: "production:read",
  PRODUCTION_UPDATE: "production:update",
  ROUNDS_READ: "rounds:read",
  ROUNDS_MANAGE: "rounds:manage",
  STOPS_UPDATE: "stops:update",
  INVOICES_READ: "invoices:read",
  INVOICES_CREATE: "invoices:create",
  INVOICES_UPDATE: "invoices:update",
  SETTINGS_READ: "settings:read",
  SETTINGS_UPDATE: "settings:update",
  SUPPORT_READ: "support:read",
  SUPPORT_CREATE: "support:create",
  DASHBOARD_ADMIN: "dashboard:admin",
  DASHBOARD_COMPANY: "dashboard:company",
  DASHBOARD_BAKER: "dashboard:baker",
  DASHBOARD_DRIVER: "dashboard:driver",
  DASHBOARD_MERCHANT: "dashboard:merchant",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export function hasPermission(
  userPermissions: string[],
  required: Permission | Permission[]
): boolean {
  const requiredList = Array.isArray(required) ? required : [required];
  return requiredList.every((p) => userPermissions.includes(p));
}

export function hasAnyPermission(
  userPermissions: string[],
  required: Permission[]
): boolean {
  return required.some((p) => userPermissions.includes(p));
}

export function getRoleLabel(role: SystemRole): string {
  return ROLE_LABELS[role];
}

export function getRoleColor(role: SystemRole): string {
  const colors: Record<SystemRole, string> = {
    SUPER_ADMIN: "border-transparent bg-red-100 text-red-800 dark:bg-error-subtle dark:text-error",
    ADMIN: "border-transparent bg-red-100 text-red-800 dark:bg-error-subtle dark:text-error",
    BAKER: "border-transparent bg-amber-100 text-amber-800 dark:bg-warning-subtle dark:text-warning",
    DRIVER: "border-transparent bg-orange-100 text-orange-800 dark:bg-warning-subtle dark:text-warning",
    MERCHANT: "border-transparent bg-blue-100 text-blue-800 dark:bg-[#1f2c40] dark:text-[#8fb5ee]",
  };
  return colors[role];
}
