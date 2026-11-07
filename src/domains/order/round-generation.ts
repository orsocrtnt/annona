/**
 * Tournées calculées à l'heure limite (LOCK-1 : RG-08, RG-09, ADM-06), module pur.
 *
 * Une tournée correspond à un créneau (RG-08) : les commandes verrouillées d'un créneau sont
 * réparties en tournées par le calcul existant (`planRounds`, insertion au moindre coût), au départ
 * du laboratoire. Aucune tournée n'a de livreur : l'attribution et l'édition relèvent de TOUR-1.
 *
 * Nombre de tournées : le moins possible. On commence par ⌈commandes / 30⌉ tournées et on en ajoute
 * une tant que des arrêts ne tiennent pas dans le créneau (10 essais au plus). Si le créneau reste
 * intenable, les tournées sont calculées sans contrainte d'horaire (tout le monde est livré, l'admin
 * verra les retards en TOUR-1). Un commerce sans coordonnées GPS passe en fin de dernière tournée.
 */
import { planRounds, type RoundDelivery, type RoundDriver, type RoundOptions } from "@/lib/dispatch/round-planner";
import type { GeoPoint } from "@/lib/dispatch/travel-time";

/** Arrêts au plus par tournée. */
export const ROUND_MAX_STOPS = 30;
/** Temps passé à chaque arrêt (déchargement, remise). */
export const ROUND_STOP_SECONDS = 180;
/** Départ du laboratoire avant le début du créneau. */
export const ROUND_DEPARTURE_LEAD_MINUTES = 30;
/** Durée maximale d'une tournée. */
export const ROUND_MAX_DAY_SECONDS = 5 * 3600;
const EXTRA_ROUND_ATTEMPTS = 10;

export interface SlotRoundOrder {
  id: string;
  point: GeoPoint | null;
  /** Nom du commerce : ordre stable des commerces sans coordonnées. */
  label: string;
}

export interface SlotRoundInput {
  orders: SlotRoundOrder[];
  depot: GeoPoint | null;
  /** Début et fin du créneau (instants en millisecondes). */
  windowStart: number;
  windowEnd: number;
  travelSeconds: (from: GeoPoint, to: GeoPoint) => number;
}

export interface PlannedRound {
  /** Commandes dans l'ordre de livraison (arrêt 1 en premier). */
  orderIds: string[];
  /** Heure d'arrivée estimée de chaque arrêt, ou `null` (commerce sans coordonnées). */
  arrivals: Array<number | null>;
}

function drivers(count: number, depot: GeoPoint | null, readyAt: number, ids: ReadonlySet<string>): RoundDriver[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `r${String(index + 1).padStart(2, "0")}`,
    start: depot,
    readyAt,
    capacityKg: null,
    eligibleDeliveryIds: ids,
  }));
}

/** Tournées d'un créneau, dans l'ordre de leur première heure d'arrivée. */
export function planSlotRounds(input: SlotRoundInput): PlannedRound[] {
  const located = input.orders.filter((order): order is SlotRoundOrder & { point: GeoPoint } => order.point !== null);
  const unlocated = input.orders.filter((order) => order.point === null).sort((a, b) => a.label.localeCompare(b.label, "fr") || a.id.localeCompare(b.id));
  const rounds: PlannedRound[] = [];

  if (located.length > 0) {
    const departure = input.windowStart - ROUND_DEPARTURE_LEAD_MINUTES * 60_000;
    const options: RoundOptions = {
      now: departure,
      stopSeconds: ROUND_STOP_SECONDS,
      maxDaySeconds: ROUND_MAX_DAY_SECONDS,
      maxDeliveries: ROUND_MAX_STOPS,
      travelSeconds: input.travelSeconds,
    };
    const ids = new Set(located.map((order) => order.id));
    const deliveries = (windowed: boolean): RoundDelivery[] =>
      located.map((order) => ({
        id: order.id,
        destination: order.point,
        pickup: null,
        weightKg: null,
        windowStart: windowed ? input.windowStart : null,
        windowEnd: windowed ? input.windowEnd : null,
        urgent: false,
      }));

    const minimum = Math.max(1, Math.ceil(located.length / ROUND_MAX_STOPS));
    const maximum = Math.min(located.length, minimum + EXTRA_ROUND_ATTEMPTS - 1);
    let plan: ReturnType<typeof planRounds> | null = null;
    for (let count = minimum; count <= maximum; count += 1) {
      const attempt = planRounds(deliveries(true), drivers(count, input.depot, departure, ids), options);
      if (attempt.unplanned.length === 0) {
        plan = attempt;
        break;
      }
    }
    // Créneau intenable : calcul sans horaire, avec le nombre minimal de tournées.
    plan ??= planRounds(deliveries(false), drivers(minimum, input.depot, departure, ids), options);

    for (const round of plan.rounds) {
      rounds.push({
        orderIds: round.evaluation.stops.map((stop) => stop.deliveryId),
        arrivals: round.evaluation.stops.map((stop) => stop.arrivalAt),
      });
    }
    // Restes éventuels (limite de durée) : en fin de la tournée la plus courte, sans heure estimée.
    for (const left of plan.unplanned) {
      if (rounds.length === 0) rounds.push({ orderIds: [], arrivals: [] });
      const shortest = rounds.reduce((best, round) => (round.orderIds.length < best.orderIds.length ? round : best));
      shortest.orderIds.push(left.deliveryId);
      shortest.arrivals.push(null);
    }
  }

  if (unlocated.length > 0) {
    if (rounds.length === 0) rounds.push({ orderIds: [], arrivals: [] });
    const last = rounds[rounds.length - 1]!;
    for (const order of unlocated) {
      last.orderIds.push(order.id);
      last.arrivals.push(null);
    }
  }

  return rounds
    .filter((round) => round.orderIds.length > 0)
    .sort((a, b) => (a.arrivals[0] ?? Number.POSITIVE_INFINITY) - (b.arrivals[0] ?? Number.POSITIVE_INFINITY));
}

export interface RoundStopPoint {
  id: string;
  point: GeoPoint | null;
  label: string;
}

/**
 * TOUR-1 (ADM-06) : « Recalculer l'ordre » d'une seule tournée avec le même calcul (insertion au
 * moindre coût), au départ de `start` (laboratoire, ou dernier arrêt déjà livré). Sans contrainte de
 * créneau ni de durée : l'administrateur a choisi les arrêts, on ne fait que les ordonner. Les commerces
 * sans coordonnées restent en fin, par nom.
 */
export function orderRoundStops(input: {
  start: GeoPoint | null;
  stops: RoundStopPoint[];
  travelSeconds: (from: GeoPoint, to: GeoPoint) => number;
}): string[] {
  const located = input.stops.filter((stop): stop is RoundStopPoint & { point: GeoPoint } => stop.point !== null);
  const unlocated = input.stops
    .filter((stop) => stop.point === null)
    .sort((a, b) => a.label.localeCompare(b.label, "fr") || a.id.localeCompare(b.id));
  if (located.length === 0) return unlocated.map((stop) => stop.id);
  const ids = new Set(located.map((stop) => stop.id));
  const plan = planRounds(
    located.map((stop) => ({ id: stop.id, destination: stop.point, pickup: null, weightKg: null, windowStart: null, windowEnd: null, urgent: false })),
    [{ id: "r01", start: input.start, readyAt: 0, capacityKg: null, eligibleDeliveryIds: ids }],
    { now: 0, stopSeconds: ROUND_STOP_SECONDS, maxDaySeconds: Number.MAX_SAFE_INTEGER, maxDeliveries: Number.MAX_SAFE_INTEGER, travelSeconds: input.travelSeconds }
  );
  const ordered = plan.rounds[0]?.evaluation.stops.map((stop) => stop.deliveryId) ?? [];
  const placed = new Set(ordered);
  const left = located.filter((stop) => !placed.has(stop.id)).map((stop) => stop.id);
  return [...ordered, ...left, ...unlocated.map((stop) => stop.id)];
}
