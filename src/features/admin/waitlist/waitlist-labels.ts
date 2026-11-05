/** ADMIN-ESPACE lot 2 : libellés partagés de la page Liste d'attente (sans dépendance serveur). */

/** Code de campagne lisible : « Direct » sans code, « Inconnue » pour les inscriptions d'avant le suivi. */
export function campaignLabel(code: string | null): string {
  if (code === null) return "Inconnue";
  if (code === "direct") return "Direct";
  return code;
}

/** Part en pour cent, au dixième ; `null` si la base est vide. */
export function percentOf(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;
}
