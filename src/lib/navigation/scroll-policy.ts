/**
 * UX-NAV-SCROLL : politique de défilement lors d'un changement de page.
 *
 * - Nouvelle page ouverte depuis un lien ou un menu : on repart en haut.
 * - Retour / Avancer (popstate) : on laisse le navigateur et Next restaurer la position enregistrée.
 * - Ancre (#section) : le navigateur place la section, on n'y touche pas.
 * - Même chemin (filtre, pagination, tri qui ne changent que la recherche) : jamais de saut.
 */
export function shouldResetScrollOnNavigation(input: {
  previousPathname: string | null;
  pathname: string;
  hash: string;
  /** Chemin atteint par un événement popstate (Retour/Avancer) en attente d'être rendu, sinon null. */
  historyPathname: string | null;
}): boolean {
  if (input.previousPathname === null || input.previousPathname === input.pathname) return false;
  if (input.hash) return false;
  if (input.historyPathname === input.pathname) return false;
  return true;
}
