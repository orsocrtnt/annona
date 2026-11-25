/**
 * RETOURS-3 (notes du tour 2 de Théo, 24 novembre 2026) : les deux espaces de production (rôles internes `BAKER`
 * et `PASTRY_CHEF`, routes `/bakery` et `/pastry`) sont des « laboratoires » que le gérant nomme comme il veut
 * (Paramètres › Laboratoires) : « Laboratoire boulanger », « Labo pâtisserie », « Atelier découpe »… Un seul type
 * d'espace, seul le nom change. Les noms vivent dans `Company.settings.spaceNames` (pas de migration) et la
 * session les porte déjà au navigateur (`user.company.settings`).
 *
 * Module sans dépendance serveur : lu par le menu, l'en-tête, la liste des comptes et l'écran Production.
 */
import type { SystemRole } from "@prisma/client";
import { ROLE_LABELS } from "@/lib/permissions/rbac";

export type SpaceKey = "production" | "atelier";

export interface SpaceNames {
  /** Espace du rôle `BAKER` (routes `/bakery`). */
  production: string;
  /** Espace du rôle `PASTRY_CHEF` (routes `/pastry`). */
  atelier: string;
}

/** Noms par défaut, neutres pour tous les métiers (`docs/VOCABULAIRE.md`). */
export const DEFAULT_SPACE_NAMES: SpaceNames = {
  production: "Laboratoire de production",
  atelier: "Second laboratoire",
};

export const SPACE_NAME_MAX = 40;

function cleanName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.replace(/\s+/g, " ").trim();
  return name && name.length <= SPACE_NAME_MAX ? name : null;
}

/** Noms des deux laboratoires d'une entreprise ; un nom absent ou invalide reprend sa valeur par défaut. */
export function readSpaceNames(settings: unknown): SpaceNames {
  const raw =
    settings && typeof settings === "object" && !Array.isArray(settings)
      ? (settings as Record<string, unknown>).spaceNames
      : undefined;
  const names = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return {
    production: cleanName(names.production) ?? DEFAULT_SPACE_NAMES.production,
    atelier: cleanName(names.atelier) ?? DEFAULT_SPACE_NAMES.atelier,
  };
}

/** Libellé affiché d'un rôle dans une entreprise : les deux laboratoires prennent le nom choisi par le gérant. */
export function roleLabelFor(role: SystemRole, names: SpaceNames = DEFAULT_SPACE_NAMES): string {
  if (role === "BAKER") return names.production;
  if (role === "PASTRY_CHEF") return names.atelier;
  return ROLE_LABELS[role] ?? role;
}

/** Nom de l'espace ouvert par une adresse du back-office (`/bakery…` ou `/pastry…`), sinon `null`. */
export function spaceNameForPath(pathname: string, names: SpaceNames): string | null {
  if (pathname === "/bakery" || pathname.startsWith("/bakery/")) return names.production;
  if (pathname === "/pastry" || pathname.startsWith("/pastry/")) return names.atelier;
  return null;
}
