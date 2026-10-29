/** Où et comment afficher les alertes opérationnelles selon l'espace et la page (UX-ALERTES). */

export type AlertSpace = "staff" | "client" | "driver";
/** summary : bandeau compact en haut ; floating : seulement l'accès « Alertes » ; mission : mission en cours en haut, le reste derrière l'accès. */
export type AlertMode = "summary" | "floating" | "mission";

const SUPERVISION_PAGES: Record<Exclude<AlertSpace, "driver">, string[]> = {
  staff: ["/dashboard", "/dispatch", "/dashboard/orders", "/dashboard/deliveries"],
  client: ["/portal", "/portal/orders", "/portal/deliveries"],
};

export function alertModeForPath(space: AlertSpace, pathname: string): AlertMode {
  if (space === "driver") return "mission";
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return SUPERVISION_PAGES[space].includes(path) ? "summary" : "floating";
}

export type PlacedAlert = { missionActive?: boolean };

/** Sépare les alertes de la mission en cours de toutes les autres. */
export function splitAlertsForMode<T extends PlacedAlert>(rows: T[], mode: AlertMode): { top: T[]; behindAccess: T[] } {
  if (mode === "summary") return { top: rows, behindAccess: [] };
  if (mode === "floating") return { top: [], behindAccess: rows };
  return { top: rows.filter(row => row.missionActive), behindAccess: rows.filter(row => !row.missionActive) };
}

export function alertAccessLabel(count: number): string {
  return count === 1 ? "Alertes, 1 à suivre" : `Alertes, ${count} à suivre`;
}

/** Résumé d'une ligne : l'alerte la plus ancienne en tête, le reste compté. */
export function alertSummaryLine(lead: string, count: number): string {
  return count > 1 ? `${lead} · +${count - 1} autre${count > 2 ? "s" : ""}` : lead;
}
