import type { PermissionSlug } from "./rbac";

/**
 * Lot 1, demande 4 — comptes « mini admin ».
 *
 * Un mini admin est un compte administrateur de l'entreprise (rôle ADMIN) dont les fonctionnalités
 * accordées sont rangées dans `User.settings.miniAdmin.modules`. Sans cette clé : administrateur
 * complet. Les modules se traduisent en permissions : les permissions effectives d'un mini admin sont
 * celles du rôle ADMIN limitées à ses modules (`effectivePermissions`), relues en base à chaque requête
 * (aucune reconnexion). Chaque page du back-office porte aussi son module (`page-access.ts`) : une
 * adresse tapée à la main d'un module non accordé est refusée.
 *
 * Le module donne les permissions nécessaires à ses écrans ; une lecture partagée (liste des produits,
 * des clients ou des tournées dans un formulaire) est ouverte côté API à plusieurs permissions.
 */
export const MINI_ADMIN_MODULE_IDS = [
  "dashboard",
  "orders",
  "tracking",
  "rounds",
  "catalog",
  "promotions",
  "accounts",
  "settings",
  "billing",
  "support",
] as const;

export type MiniAdminModuleId = (typeof MINI_ADMIN_MODULE_IDS)[number];

export interface MiniAdminModule {
  id: MiniAdminModuleId;
  label: string;
  /** Pages du module ; la première sert d'accueil quand le module est le premier accordé. */
  paths: readonly string[];
  permissions: readonly PermissionSlug[];
}

export const MINI_ADMIN_MODULES: readonly MiniAdminModule[] = [
  { id: "dashboard", label: "Tableau de bord", paths: ["/dashboard"], permissions: ["dashboard:company"] },
  { id: "orders", label: "Commandes", paths: ["/dashboard/orders"], permissions: ["orders:read", "orders:create", "orders:update"] },
  { id: "tracking", label: "Suivi des livreurs", paths: ["/dashboard/tracking"], permissions: ["tracking:read"] },
  { id: "rounds", label: "Tournées", paths: ["/dashboard/rounds"], permissions: ["rounds:read", "rounds:manage", "stops:update"] },
  { id: "catalog", label: "Catalogue et prix", paths: ["/dashboard/catalog"], permissions: ["catalog:read", "catalog:manage"] },
  { id: "promotions", label: "Promotions", paths: ["/dashboard/promotions"], permissions: ["promotions:read", "promotions:manage"] },
  {
    id: "accounts",
    label: "Comptes clients, boulangers et livreurs",
    paths: ["/dashboard/merchants", "/users"],
    permissions: ["merchants:read", "merchants:manage", "users:read", "users:create", "users:update", "users:delete"],
  },
  { id: "settings", label: "Paramètres", paths: ["/settings"], permissions: ["settings:read", "settings:update", "companies:read", "companies:update"] },
  {
    id: "billing",
    label: "Facturation et paiements",
    paths: ["/dashboard/invoices", "/settings/billing"],
    permissions: ["invoices:read", "invoices:create", "invoices:update"],
  },
  { id: "support", label: "Support", paths: ["/support"], permissions: ["support:read"] },
];

const KNOWN = new Set<string>(MINI_ADMIN_MODULE_IDS);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Modules d'un mini admin, dans l'ordre du menu ; `null` = administrateur complet (ou autre rôle).
 * Une valeur illisible n'ouvre jamais plus : liste vide (aucun écran).
 */
export function miniAdminModules(user: { settings?: unknown; role?: { systemRole?: string } | null }): MiniAdminModuleId[] | null {
  if (user.role?.systemRole !== undefined && user.role.systemRole !== "ADMIN") return null;
  if (!isRecord(user.settings) || !("miniAdmin" in user.settings)) return null;
  const miniAdmin = user.settings.miniAdmin;
  const modules = isRecord(miniAdmin) && Array.isArray(miniAdmin.modules) ? miniAdmin.modules : [];
  const granted = new Set(modules.filter((id): id is string => typeof id === "string" && KNOWN.has(id)));
  return MINI_ADMIN_MODULE_IDS.filter((id) => granted.has(id));
}

/** Liste propre de modules à enregistrer (ordre du menu, sans doublon ni inconnu). */
export function normalizeModules(modules: readonly string[]): MiniAdminModuleId[] {
  const granted = new Set(modules);
  return MINI_ADMIN_MODULE_IDS.filter((id) => granted.has(id));
}

/** Permissions données par des modules. */
export function modulePermissions(modules: readonly MiniAdminModuleId[]): Set<string> {
  const allowed = new Set<string>();
  for (const entry of MINI_ADMIN_MODULES) {
    if (modules.includes(entry.id)) for (const permission of entry.permissions) allowed.add(permission);
  }
  return allowed;
}

/** Permissions effectives : celles du rôle, limitées aux modules pour un mini admin. */
export function effectivePermissions(rolePermissions: readonly string[], modules: readonly MiniAdminModuleId[] | null): string[] {
  if (modules === null) return [...rolePermissions];
  const allowed = modulePermissions(modules);
  return rolePermissions.filter((permission) => allowed.has(permission));
}

/** Accueil d'un mini admin : la première page de son premier module ; `null` sans module. */
export function miniAdminHomePath(modules: readonly MiniAdminModuleId[]): string | null {
  const first = MINI_ADMIN_MODULES.find((entry) => modules.includes(entry.id));
  return first?.paths[0] ?? null;
}

/** Réglages d'un compte avec ses modules (`null` : administrateur complet, clé retirée). */
export function withMiniAdminModules(settings: unknown, modules: readonly string[] | null): Record<string, unknown> {
  const next: Record<string, unknown> = isRecord(settings) ? { ...settings } : {};
  if (modules === null) delete next.miniAdmin;
  else next.miniAdmin = { modules: normalizeModules(modules) };
  return next;
}
