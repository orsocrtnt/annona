import type { SystemRole } from "@prisma/client";

export const PERMISSIONS = {
  USERS_READ: "users:read",
  USERS_CREATE: "users:create",
  USERS_UPDATE: "users:update",
  USERS_DELETE: "users:delete",
  COMPANIES_READ: "companies:read",
  COMPANIES_CREATE: "companies:create",
  COMPANIES_UPDATE: "companies:update",
  COMPANIES_DELETE: "companies:delete",
  DELIVERIES_READ: "deliveries:read",
  DELIVERIES_CREATE: "deliveries:create",
  DELIVERIES_UPDATE: "deliveries:update",
  DELIVERIES_DELETE: "deliveries:delete",
  DELIVERIES_DISPATCH: "deliveries:dispatch",
  ORDERS_READ: "orders:read",
  ORDERS_CREATE: "orders:create",
  ORDERS_UPDATE: "orders:update",
  DRIVERS_READ: "drivers:read",
  DRIVERS_MANAGE: "drivers:manage",
  VEHICLES_READ: "vehicles:read",
  VEHICLES_MANAGE: "vehicles:manage",
  ANALYTICS_READ: "analytics:read",
  SETTINGS_READ: "settings:read",
  SETTINGS_UPDATE: "settings:update",
  DASHBOARD_ADMIN: "dashboard:admin",
  DASHBOARD_COMPANY: "dashboard:company",
  DASHBOARD_DISPATCHER: "dashboard:dispatcher",
  DASHBOARD_DRIVER: "dashboard:driver",
  DASHBOARD_CLIENT: "dashboard:client",
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
  const labels: Record<SystemRole, string> = {
    SUPER_ADMIN: "Super Admin",
    COMPANY_ADMIN: "Administrateur",
    MINI_ADMIN: "Mini-admin",
    DISPATCHER: "Dispatcher",
    DRIVER: "Livreur",
    CLIENT: "Client",
  };
  return labels[role];
}

export function getRoleColor(role: SystemRole): string {
  const colors: Record<SystemRole, string> = {
    SUPER_ADMIN: "border-transparent bg-red-100 text-red-800 dark:bg-error-subtle dark:text-error",
    COMPANY_ADMIN: "border-transparent bg-red-100 text-red-800 dark:bg-error-subtle dark:text-error",
    MINI_ADMIN: "border-transparent bg-indigo-100 text-indigo-800 dark:bg-[#26283f] dark:text-[#b4b8f0]",
    DISPATCHER: "border-transparent bg-slate-100 text-slate-800 dark:bg-muted dark:text-foreground",
    DRIVER: "border-transparent bg-orange-100 text-orange-800 dark:bg-warning-subtle dark:text-warning",
    CLIENT: "border-transparent bg-blue-100 text-blue-800 dark:bg-[#1f2c40] dark:text-[#8fb5ee]",
  };
  return colors[role];
}
