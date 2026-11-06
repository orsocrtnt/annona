import type { SystemRole } from "@prisma/client";
import type { PermissionSlug } from "./rbac";

/**
 * Source unique des accès aux pages protégées (AUTH-ROLE).
 *
 * Lue par le middleware (refus serveur avant tout rendu, y compris les requêtes RSC
 * et les préchargements), par la garde navigateur, les liens conditionnels
 * (`useCanOpenPage`) et `getAllowedRolesForPath`. Les API gardent
 * leurs propres contrôles : cette table protège les pages, pas les données.
 */
export interface PageAccessRule {
  /** Segment d'URL : la règle couvre ce chemin et ses sous-pages ; la plus longue l'emporte. */
  path: string;
  roles: readonly SystemRole[];
  /** Au moins une de ces permissions. */
  anyPermission?: readonly PermissionSlug[];
}

const COMPANY_ADMINS: readonly SystemRole[] = ["ADMIN"];

export const PAGE_ACCESS_RULES: readonly PageAccessRule[] = [
  // Plateforme
  { path: "/admin", roles: ["SUPER_ADMIN"], anyPermission: ["dashboard:admin"] },
  { path: "/companies", roles: ["SUPER_ADMIN"], anyPermission: ["companies:read"] },
  // Entreprise (administrateur)
  { path: "/dashboard", roles: COMPANY_ADMINS, anyPermission: ["dashboard:company"] },
  { path: "/dashboard/orders", roles: COMPANY_ADMINS, anyPermission: ["orders:read"] },
  { path: "/dashboard/rounds", roles: COMPANY_ADMINS, anyPermission: ["rounds:read"] },
  { path: "/dashboard/merchants", roles: COMPANY_ADMINS, anyPermission: ["merchants:read"] },
  { path: "/dashboard/catalog", roles: COMPANY_ADMINS, anyPermission: ["catalog:read"] },
  { path: "/dashboard/invoices", roles: COMPANY_ADMINS, anyPermission: ["invoices:read"] },
  { path: "/support", roles: COMPANY_ADMINS, anyPermission: ["support:read"] },
  { path: "/users", roles: COMPANY_ADMINS, anyPermission: ["users:read"] },
  { path: "/settings", roles: COMPANY_ADMINS, anyPermission: ["settings:read"] },
  { path: "/settings/billing", roles: COMPANY_ADMINS, anyPermission: ["invoices:read"] },
  // Boulanger, portail client et application livreur
  { path: "/bakery", roles: ["BAKER"], anyPermission: ["dashboard:baker"] },
  { path: "/portal", roles: ["MERCHANT"], anyPermission: ["dashboard:merchant"] },
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

function ruleAllowsRoleAndPermissions(
  rule: PageAccessRule,
  role: SystemRole,
  permissions: readonly string[]
): boolean {
  if (!rule.roles.includes(role)) return false;
  if (!rule.anyPermission) return true;
  return rule.anyPermission.some((slug) => permissions.includes(slug));
}

/** Espace d'accueil du rôle (redirection après connexion ou refus d'un espace). */
export function getRoleHomePath(role: SystemRole): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "/admin";
    case "ADMIN":
      return "/dashboard";
    case "BAKER":
      return "/bakery";
    case "DRIVER":
      return "/driver";
    case "MERCHANT":
      return "/portal";
  }
}

export interface PageAccessSubject {
  role: SystemRole;
  /** Permissions effectives, relues en base. */
  permissions: readonly string[];
}

/** Une page protégée est-elle ouverte à ce sujet ? Hors espace protégé : oui. */
export function canOpenPage(pathname: string, subject: PageAccessSubject): boolean {
  if (!isProtectedPagePath(pathname)) return true;
  const rule = getPageAccessRule(pathname);
  return Boolean(rule && ruleAllowsRoleAndPermissions(rule, subject.role, subject.permissions));
}

export type PageAccessDecision =
  | { kind: "allow" }
  /** Mauvais espace : redirection serveur vers l'espace du rôle. */
  | { kind: "redirect"; location: string }
  /** Aucun espace ouvert (rôle sans permission d'accueil) : refus explicite. */
  | { kind: "forbidden" };

/**
 * Décision serveur pour une page. La redirection ne vise qu'un accueil lui-même
 * autorisé et différent du chemin demandé : aucune boucle possible.
 */
export function evaluatePageAccess(pathname: string, subject: PageAccessSubject): PageAccessDecision {
  if (canOpenPage(pathname, subject)) return { kind: "allow" };
  const home = getRoleHomePath(subject.role);
  if (home !== pathname && canOpenPage(home, subject)) return { kind: "redirect", location: home };
  return { kind: "forbidden" };
}
