import type { NavItem } from "@/types";

export const ONBOARDING_HREF = "/onboarding";

/**
 * « Première livraison » n'apparaît dans la navigation principale que tant que le parcours est proposé :
 * ni terminé, ni masqué. Statut inconnu (chargement, erreur, autre rôle) : l'entrée reste hors du menu ;
 * le guide reste accessible depuis l'Aide du menu du compte.
 */
export function applyOnboardingNavVisibility(
  items: NavItem[],
  status: { showInNavigation: boolean } | undefined
): NavItem[] {
  if (status?.showInNavigation === true) return items;
  return items.filter((item) => item.href !== ONBOARDING_HREF);
}
