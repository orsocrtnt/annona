/**
 * TOUR-1 — règles pures des tournées (ADM-06, LIV-01 à LIV-04). Aucun accès base ni réseau : testées
 * directement dans `tests/tour1-rounds.test.ts`.
 */
import type { RoundStatus, StopStatus } from "@prisma/client";

/** Raisons d'un problème signalé par le livreur (LIV-05). */
export const STOP_INCIDENT_CODES = ["ABSENT", "REFUSED", "DAMAGED", "OTHER"] as const;
export type StopIncidentCode = (typeof STOP_INCIDENT_CODES)[number];

/** Tournées que l'administrateur peut encore modifier (ordre, arrêts, livreur). */
export const EDITABLE_ROUND_STATUSES: readonly RoundStatus[] = ["DRAFT", "ASSIGNED", "IN_PROGRESS"];
/** Tournées visibles par le livreur : validées par l'administrateur (jamais un brouillon). */
export const DRIVER_VISIBLE_ROUND_STATUSES: readonly RoundStatus[] = ["ASSIGNED", "IN_PROGRESS", "COMPLETED"];

/**
 * Nombre de colis d'un arrêt (LIV-01). Aucun nombre de colis n'est enregistré (BOU-1 le saisit à
 * l'impression des étiquettes sans le garder) : on compte **un colis par ligne de commande** (un sac
 * ou une caisse par produit), les lignes à zéro (manquant total) exclues. La somme des quantités
 * est donnée à part (« articles ») : 30 baguettes ne font pas 30 colis.
 */
export function stopPackages(lines: ReadonlyArray<{ quantityOrdered: number; quantityDelivered: number | null }>) {
  const quantities = lines.map((line) => line.quantityDelivered ?? line.quantityOrdered).filter((quantity) => quantity > 0);
  return { packages: quantities.length, items: quantities.reduce((sum, quantity) => sum + quantity, 0) };
}

/**
 * Nouvel ordre d'une tournée demandé par l'administrateur : il doit contenir exactement les arrêts de la
 * tournée, chacun une fois. Renvoie les identifiants dans l'ordre, ou `null` si la liste ne correspond pas.
 */
export function validateStopOrder(current: readonly string[], requested: readonly string[]): string[] | null {
  if (requested.length !== current.length) return null;
  const expected = new Set(current);
  const seen = new Set<string>();
  for (const id of requested) {
    if (!expected.has(id) || seen.has(id)) return null;
    seen.add(id);
  }
  return [...requested];
}

/** Numéros de passage continus, sans trou : 1, 2, 3… dans l'ordre donné. */
export function sequenceUpdates(orderedIds: readonly string[]): Array<{ id: string; sequence: number }> {
  return orderedIds.map((id, index) => ({ id, sequence: index + 1 }));
}

/**
 * Déplace un arrêt d'une tournée à une autre (ADM-06) : retiré de la source, inséré dans la cible à la
 * position voulue (1 = en premier ; absente ou trop grande = en dernier). Renvoie les deux ordres.
 */
export function moveStopBetween(
  source: readonly string[],
  target: readonly string[],
  stopId: string,
  position?: number | null
): { source: string[]; target: string[] } {
  const nextSource = source.filter((id) => id !== stopId);
  const nextTarget = target.filter((id) => id !== stopId);
  const index = position && position > 0 ? Math.min(position - 1, nextTarget.length) : nextTarget.length;
  nextTarget.splice(index, 0, stopId);
  return { source: nextSource, target: nextTarget };
}

/** Déplace un arrêt dans sa tournée (glisser-déposer, ou boutons monter / descendre). */
export function moveWithinRound(order: readonly string[], stopId: string, position: number): string[] {
  const rest = order.filter((id) => id !== stopId);
  if (rest.length === order.length) return [...order];
  const index = Math.max(0, Math.min(position - 1, rest.length));
  rest.splice(index, 0, stopId);
  return rest;
}

/**
 * LIV-02 : liste de chargement = ordre inverse de livraison (comme BOU-03) : le dernier arrêt est
 * chargé en premier, au fond du véhicule ; le premier client livré est à portée de main.
 */
export function loadingOrder<T extends { sequence: number }>(stops: readonly T[]): T[] {
  return [...stops].sort((a, b) => b.sequence - a.sequence);
}

/** LIV-04 : arrêt proposé après « Livré » : le prochain arrêt encore à livrer, dans l'ordre de passage. */
export function nextPendingStop<T extends { id: string; sequence: number; status: StopStatus }>(
  stops: readonly T[],
  afterStopId?: string | null
): T | null {
  const ordered = [...stops].sort((a, b) => a.sequence - b.sequence);
  const pending = ordered.filter((stop) => stop.status === "PENDING" && stop.id !== afterStopId);
  if (!afterStopId) return pending[0] ?? null;
  const current = ordered.find((stop) => stop.id === afterStopId);
  if (!current) return pending[0] ?? null;
  return pending.find((stop) => stop.sequence > current.sequence) ?? pending[0] ?? null;
}

/** Plus de 2 minutes dans le futur : l'horloge du téléphone est fausse, on garde l'heure du serveur. */
const CLOCK_SKEW_MS = 2 * 60_000;
/** Une action hors réseau reste au plus 7 jours sur l'appareil (file hors ligne, LEGAL-1). */
const MAX_REPLAY_AGE_MS = 7 * 24 * 60 * 60_000;

/**
 * LIV-03 : horodatage automatique pris au moment de l'appui sur le téléphone (même hors réseau), pour
 * que l'heure de livraison soit celle du geste et non celle de la synchronisation. Une heure absente,
 * dans le futur ou trop ancienne est remplacée par l'heure du serveur.
 */
export function deliveryInstant(clientAt: string | null | undefined, now: Date): Date {
  if (!clientAt) return now;
  const at = new Date(clientAt);
  const time = at.getTime();
  if (Number.isNaN(time) || time > now.getTime() + CLOCK_SKEW_MS || time < now.getTime() - MAX_REPLAY_AGE_MS) return now;
  return time > now.getTime() ? now : at;
}

/** Bilan d'une tournée : livrés, incidents, restants (ADM-08). */
export function roundProgress(stops: ReadonlyArray<{ status: StopStatus }>) {
  const delivered = stops.filter((stop) => stop.status === "DELIVERED").length;
  const incidents = stops.filter((stop) => stop.status === "INCIDENT").length;
  return { total: stops.length, delivered, incidents, remaining: stops.length - delivered - incidents };
}
