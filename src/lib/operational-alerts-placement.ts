/** Où et comment afficher les alertes opérationnelles selon l'espace et la page (UX-ALERTES). */

export type AlertSpace = "staff" | "client" | "driver";
/**
 * summary : bandeau compact en haut ; floating : seulement l'accès « Alertes » ;
 * mission : mission en cours en haut, le reste derrière l'accès ;
 * context : fiche détaillée, alertes de la commande/livraison de la page en haut, le reste derrière l'accès.
 */
export type AlertMode = "summary" | "floating" | "mission" | "context";
export type AlertContext = { orderId?: string; deliveryId?: string };
export type AlertPlacement = { mode: AlertMode; context?: AlertContext };

const SUPERVISION_PAGES: Record<Exclude<AlertSpace, "driver">, string[]> = {
  staff: ["/dashboard", "/dispatch", "/dashboard/orders", "/dashboard/deliveries"],
  client: ["/portal", "/portal/orders"],
};
const DETAIL_PAGES: Record<Exclude<AlertSpace, "driver">, Array<{ prefix: string; key: keyof AlertContext }>> = {
  staff: [{ prefix: "/dashboard/orders/", key: "orderId" }, { prefix: "/dashboard/deliveries/", key: "deliveryId" }],
  client: [{ prefix: "/portal/orders/", key: "orderId" }, { prefix: "/portal/deliveries/", key: "deliveryId" }],
};

export function alertPlacementForPath(space: AlertSpace, pathname: string): AlertPlacement {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (space === "driver") return { mode: path.startsWith("/driver/profile") ? "floating" : "mission" };
  if (SUPERVISION_PAGES[space].includes(path)) return { mode: "summary" };
  for (const { prefix, key } of DETAIL_PAGES[space]) {
    if (!path.startsWith(prefix)) continue;
    const id = decodeURIComponent(path.slice(prefix.length));
    if (id && id !== "new" && !id.includes("/")) return { mode: "context", context: { [key]: id } };
  }
  return { mode: "floating" };
}

export function alertModeForPath(space: AlertSpace, pathname: string): AlertMode {
  return alertPlacementForPath(space, pathname).mode;
}

/** orderDeliveryIds : livraisons de la commande de l'alerte (un incident porte sur la commande, pas sur une livraison). */
export type PlacedAlert = { missionActive?: boolean; orderId?: string; deliveryId?: string | null; orderDeliveryIds?: string[] };

/** Sépare les alertes affichées en haut de la page de celles rangées derrière l'accès « Alertes ». */
export function splitAlertsForMode<T extends PlacedAlert>(rows: T[], mode: AlertMode, context?: AlertContext): { top: T[]; behindAccess: T[] } {
  if (mode === "summary") return { top: rows, behindAccess: [] };
  if (mode === "floating") return { top: [], behindAccess: rows };
  const onTop = mode === "mission"
    ? (row: T) => Boolean(row.missionActive)
    : (row: T) => Boolean(context && ((context.orderId && row.orderId === context.orderId) || (context.deliveryId && (row.deliveryId === context.deliveryId || row.orderDeliveryIds?.includes(context.deliveryId)))));
  return { top: rows.filter(onTop), behindAccess: rows.filter(row => !onTop(row)) };
}

export type AlertSeverity = "urgent" | "warning";
/** Urgence : à traiter ; avertissement : déjà prise en compte, suivi en cours. */
export function alertSeverity(row: { state: string }): AlertSeverity {
  return row.state === "OPEN" ? "urgent" : "warning";
}
export function alertSeverityLabel(severity: AlertSeverity): string {
  return severity === "urgent" ? "Urgent" : "Pris en compte";
}

export type AlertBannerState = "none" | "warning" | "urgent" | "error";
/** État global d'un ensemble d'alertes : erreur de chargement, urgence si une alerte est à traiter, sinon avertissement. */
export function alertBannerState(input: { error: boolean; rows: Array<{ state: string }> }): AlertBannerState {
  if (input.error) return "error";
  if (!input.rows.length) return "none";
  return input.rows.some(row => alertSeverity(row) === "urgent") ? "urgent" : "warning";
}

export function alertAccessLabel(count: number): string {
  return count === 1 ? "Alertes, 1 à suivre" : `Alertes, ${count} à suivre`;
}
export function alertToggleLabel(count: number): string {
  return `Voir les ${count} alertes`;
}

/** Résumé d'une ligne : l'alerte en tête, le reste compté. */
export function alertSummaryLine(lead: string, count: number): string {
  return count > 1 ? `${lead} · +${count - 1} autre${count > 2 ? "s" : ""}` : lead;
}
