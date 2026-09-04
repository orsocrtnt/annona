import type { SystemRole } from "@prisma/client";

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
  DRIVER: "Chauffeur",
  CLIENT: "Client",
};

/** Personnel interne (back-office), hors client et chauffeur. */
export const STAFF_ROLES: SystemRole[] = [
  "SUPER_ADMIN",
  "COMPANY_ADMIN",
  "MINI_ADMIN",
  "DISPATCHER",
];

const COMPANY_OPS_ROLES: SystemRole[] = [
  "SUPER_ADMIN",
  "COMPANY_ADMIN",
  "MINI_ADMIN",
];

const DISPATCH_ROLES: SystemRole[] = [
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

export function canAccessRoute(
  userRole: SystemRole,
  routePermissions: PermissionSlug[]
): boolean {
  const routeRoleMap: Record<string, SystemRole[]> = {
    "/admin": ["SUPER_ADMIN"],
    "/dashboard": COMPANY_OPS_ROLES,
    "/dispatch": DISPATCH_ROLES,
    "/driver": ["DRIVER"],
    "/portal": ["CLIENT"],
    "/settings": ["SUPER_ADMIN", "COMPANY_ADMIN", "MINI_ADMIN"],
    "/users": ["SUPER_ADMIN", "COMPANY_ADMIN", "MINI_ADMIN"],
    "/companies": ["SUPER_ADMIN"],
  };

  for (const [prefix, roles] of Object.entries(routeRoleMap)) {
    if (routePermissions.length > 0) return true;
    void prefix;
    void roles;
  }

  return hasRole(userRole, getAllowedRolesForPath(""));
}

export function getAllowedRolesForPath(path: string): SystemRole[] {
  if (path.startsWith("/admin")) return ["SUPER_ADMIN"];
  if (path.startsWith("/dashboard")) return COMPANY_OPS_ROLES;
  if (path.startsWith("/dispatch")) return DISPATCH_ROLES;
  if (path.startsWith("/driver")) return ["DRIVER"];
  if (path.startsWith("/portal")) return ["CLIENT"];
  if (path.startsWith("/settings")) return ["SUPER_ADMIN", "COMPANY_ADMIN", "MINI_ADMIN"];
  if (path.startsWith("/users")) return ["SUPER_ADMIN", "COMPANY_ADMIN", "MINI_ADMIN"];
  if (path.startsWith("/companies")) return ["SUPER_ADMIN"];
  return [];
}

export function buildPermissionSlug(resource: Resource, action: Action): PermissionSlug {
  return `${resource}:${action}`;
}
