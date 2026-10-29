import type { SystemRole } from "@prisma/client";
import type { PermissionSlug } from "./rbac";
import {
  getMiniAdminHomePath,
  miniAdminAllowsHref,
  parseMiniAdminSettings,
  type MiniAdminModuleId,
} from "./mini-admin";

/**
 * Source unique des accès aux pages protégées (AUTH-ROLE).
 *
 * Lue par le middleware (refus serveur avant tout rendu, y compris les requêtes RSC
 * et les préchargements), par la garde navigateur et par les anciennes aides
 * (`getAllowedRolesForPath`, `ROUTE_GUARDS`, `canAccessRoute`). Les API gardent
 * leurs propres contrôles : cette table protège les pages, pas les données.
 */
export interface PageAccessRule {
  /** Segment d'URL : la règle couvre ce chemin et ses sous-pages ; la plus longue l'emporte. */
  path: string;
  roles: readonly SystemRole[];
  /** Au moins une de ces permissions (celles du mini-admin sont déjà filtrées par ses modules). */
  anyPermission?: readonly PermissionSlug[];
  /**
   * Mini-admin : l'écran doit appartenir à un module attribué (`miniAdminAllowsHref`).
   * Pour une page hors module (détail, saisie), ces modules l'ouvrent aussi.
   */
  miniAdminModules?: readonly MiniAdminModuleId[];
}

const COMPANY_ADMINS: readonly SystemRole[] = ["COMPANY_ADMIN", "MINI_ADMIN"];
const COMPANY_OPS: readonly SystemRole[] = ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER"];

export const PAGE_ACCESS_RULES: readonly PageAccessRule[] = [
  // Plateforme
  { path: "/admin", roles: ["SUPER_ADMIN"], anyPermission: ["dashboard:admin"] },
  { path: "/companies", roles: ["SUPER_ADMIN"], anyPermission: ["companies:read"] },
  // Entreprise
  { path: "/dashboard", roles: COMPANY_ADMINS, anyPermission: ["dashboard:company"] },
  { path: "/dashboard/analytics", roles: COMPANY_ADMINS, anyPermission: ["analytics:read"] },
  { path: "/dashboard/orders", roles: COMPANY_OPS, anyPermission: ["orders:read"] },
  { path: "/dashboard/orders/intake", roles: COMPANY_OPS, anyPermission: ["orders:create"] },
  { path: "/dashboard/clients", roles: COMPANY_OPS, anyPermission: ["orders:read"] },
  { path: "/dashboard/drivers", roles: COMPANY_OPS, anyPermission: ["drivers:read"] },
  {
    path: "/dashboard/deliveries",
    roles: COMPANY_OPS,
    anyPermission: ["deliveries:read"],
    miniAdminModules: ["dispatch", "driver-map", "delivery-map"],
  },
  {
    path: "/dispatch",
    roles: COMPANY_OPS,
    anyPermission: ["deliveries:dispatch", "dashboard:dispatcher"],
  },
  { path: "/dispatch/drivers", roles: COMPANY_OPS, anyPermission: ["drivers:read"] },
  { path: "/dispatch/map", roles: COMPANY_OPS, anyPermission: ["deliveries:read"] },
  {
    path: "/dispatch/intake",
    roles: COMPANY_OPS,
    anyPermission: ["orders:create"],
    miniAdminModules: ["dispatch", "orders"],
  },
  { path: "/support", roles: COMPANY_OPS },
  { path: "/users", roles: COMPANY_ADMINS, anyPermission: ["users:read"] },
  { path: "/settings", roles: COMPANY_ADMINS, anyPermission: ["settings:read"] },
  { path: "/settings/billing", roles: COMPANY_ADMINS, anyPermission: ["invoices:read"] },
  { path: "/settings/subscription", roles: ["COMPANY_ADMIN"], anyPermission: ["settings:read"] },
  { path: "/onboarding", roles: ["COMPANY_ADMIN"], anyPermission: ["settings:read"] },
  // Portail client et application livreur
  { path: "/portal", roles: ["CLIENT"], anyPermission: ["dashboard:client"] },
  { path: "/driver", roles: ["DRIVER"], anyPermission: ["dashboard:driver"] },
];

function isWithin(pathname: string, segment: string): boolean {
  return pathname === segment || pathname.startsWith(`${segment}/`);
}

/** Espaces protégés (premier segment de chaque règle) ; doivent figurer dans le matcher du middleware. */
export const PROTECTED_PAGE_SPACES: readonly string[] = [
  ...new Set(PAGE_ACCESS_RULES.map((rule) => `/${rule.path.split("/")[1]}`)),
];

export function isProtectedPagePath(pathname: string): boolean {
  return PROTECTED_PAGE_SPACES.some((space) => isWithin(pathname, space));
}

const RULES_BY_SPECIFICITY = [...PAGE_ACCESS_RULES].sort((a, b) => b.path.length - a.path.length);

/** Règle la plus précise couvrant le chemin, ou `null` hors des espaces protégés. */
export function getPageAccessRule(pathname: string): PageAccessRule | null {
  return RULES_BY_SPECIFICITY.find((rule) => isWithin(pathname, rule.path)) ?? null;
}

/** Rôle + permission seulement : le contrôle des modules mini-admin est fait par `evaluatePageAccess`. */
export function ruleAllowsRoleAndPermissions(
  rule: PageAccessRule,
  role: SystemRole,
  permissions: readonly string[]
): boolean {
  if (!rule.roles.includes(role)) return false;
  if (!rule.anyPermission) return true;
  return rule.anyPermission.some((slug) => permissions.includes(slug));
}

/** Espace d'accueil du rôle (redirection après connexion ou refus d'un espace). */
export function getRoleHomePath(role: SystemRole, settings?: unknown): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "/admin";
    case "COMPANY_ADMIN":
      return "/dashboard";
    case "MINI_ADMIN":
      return getMiniAdminHomePath(settings);
    case "DISPATCHER":
      return "/dispatch";
    case "DRIVER":
      return "/driver";
    case "CLIENT":
      return "/portal";
  }
}

export interface PageAccessSubject {
  role: SystemRole;
  /** Permissions effectives, relues en base (filtrées par modules pour le mini-admin). */
  permissions: readonly string[];
  /** Réglages utilisateur relus en base (modules du mini-admin). */
  settings: unknown;
}

/** Une page protégée est-elle ouverte à ce sujet ? Hors espace protégé : oui. */
export function canOpenPage(pathname: string, subject: PageAccessSubject): boolean {
  if (!isProtectedPagePath(pathname)) return true;
  const rule = getPageAccessRule(pathname);
  if (!rule || !ruleAllowsRoleAndPermissions(rule, subject.role, subject.permissions)) return false;
  if (subject.role !== "MINI_ADMIN") return true;
  const { modules } = parseMiniAdminSettings(subject.settings);
  return (
    miniAdminAllowsHref(pathname, modules) ||
    (rule.miniAdminModules ?? []).some((id) => modules.includes(id))
  );
}

export type PageAccessDecision =
  | { kind: "allow" }
  /** Mauvais espace : redirection serveur vers l'espace du rôle. */
  | { kind: "redirect"; location: string }
  /** Aucun espace ouvert (mini-admin sans module, rôle sans permission d'accueil) : refus explicite. */
  | { kind: "forbidden" };

/**
 * Décision serveur pour une page. La redirection ne vise qu'un accueil lui-même
 * autorisé et différent du chemin demandé : aucune boucle possible.
 */
export function evaluatePageAccess(pathname: string, subject: PageAccessSubject): PageAccessDecision {
  if (canOpenPage(pathname, subject)) return { kind: "allow" };
  const home = getRoleHomePath(subject.role, subject.settings);
  if (home !== pathname && canOpenPage(home, subject)) return { kind: "redirect", location: home };
  return { kind: "forbidden" };
}
