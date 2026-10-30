import type { GeoPoint } from "@/lib/dispatch/travel-time";

/**
 * DISPATCH-4, piste 3 — tournées (C12). Module pur : aucun accès réseau ni base.
 *
 * Une tournée part de la position du livreur et finit au dernier arrêt. Limites : créneaux promis,
 * capacité du véhicule, zone (`eligibleDeliveryIds`), durée de la journée. Méthode : insertion au
 * moindre coût, livraison la plus urgente d'abord. C'est une heuristique : bonne et explicable,
 * pas une tournée prouvée optimale, et le dispatcher peut la modifier.
 * Coût : livraisons × livreurs × positions², borné par `maxDeliveries` et le plafond du service.
 */

export type RoundStopKind = "PICKUP" | "DROPOFF";

export type RoundDelivery = {
  id: string;
  destination: GeoPoint;
  pickup: GeoPoint | null;
  weightKg: number | null;
  /** Instants en millisecondes ; `null` sans créneau. */
  windowStart: number | null;
  windowEnd: number | null;
  /** Déjà en retard : passe avant les autres, sans limite de créneau. */
  urgent: boolean;
};

export type RoundDriver = {
  id: string;
  /** Position récente ; `null` : la tournée commence au premier arrêt. */
  start: GeoPoint | null;
  /** Disponible à partir de cet instant (missions déjà en cours). */
  readyAt: number;
  capacityKg: number | null;
  eligibleDeliveryIds: ReadonlySet<string>;
};

export type RoundStop = { deliveryId: string; kind: RoundStopKind };

export type RoundOptions = {
  now: number;
  stopSeconds: number;
  maxDaySeconds: number;
  maxDeliveries: number;
  travelSeconds: (from: GeoPoint, to: GeoPoint) => number;
};

export type RoundViolation =
  | { code: "SLOT_MISSED"; deliveryId: string; lateMinutes: number }
  | { code: "CAPACITY_EXCEEDED"; loadKg: number; capacityKg: number }
  | { code: "DAY_EXCEEDED"; minutes: number; maxMinutes: number }
  | { code: "TOO_MANY_DELIVERIES"; count: number; max: number }
  | { code: "PICKUP_AFTER_DROPOFF"; deliveryId: string }
  | { code: "NOT_ELIGIBLE"; deliveryId: string };

export type EvaluatedStop = RoundStop & { arrivalAt: number; waitSeconds: number };

export type RoundEvaluation = {
  stops: EvaluatedStop[];
  durationSeconds: number;
  /** Poids maximal à bord ; les colis sans poids comptent pour zéro. */
  maxLoadKg: number;
  unknownWeightCount: number;
  violations: RoundViolation[];
};

export type UnplannedReason = "NO_ELIGIBLE_DRIVER" | Exclude<RoundViolation["code"], "NOT_ELIGIBLE" | "PICKUP_AFTER_DROPOFF">;

export type RoundPlan = {
  rounds: Array<{ driverId: string; evaluation: RoundEvaluation }>;
  unplanned: Array<{ deliveryId: string; reason: UnplannedReason }>;
};

export function stopsForDelivery(delivery: RoundDelivery): RoundStop[] {
  return delivery.pickup
    ? [{ deliveryId: delivery.id, kind: "PICKUP" }, { deliveryId: delivery.id, kind: "DROPOFF" }]
    : [{ deliveryId: delivery.id, kind: "DROPOFF" }];
}

/** Calcule horaires, charge et limites dépassées, y compris pour une tournée modifiée à la main. */
export function evaluateRound(
  driver: RoundDriver,
  stops: RoundStop[],
  deliveries: ReadonlyMap<string, RoundDelivery>,
  options: RoundOptions
): RoundEvaluation {
  const startedAt = Math.max(options.now, driver.readyAt);
  const ids = [...new Set(stops.map((stop) => stop.deliveryId))];
  const known = ids.map((id) => deliveries.get(id)).filter((delivery): delivery is RoundDelivery => Boolean(delivery));
  let clock = startedAt;
  let position = driver.start;
  // Colis sans retrait : à bord dès le départ.
  let load = known.reduce((sum, delivery) => sum + (delivery.pickup ? 0 : delivery.weightKg ?? 0), 0);
  let maxLoad = load;
  const violations: RoundViolation[] = [];
  const pickedUp = new Set<string>();
  const evaluated: EvaluatedStop[] = [];

  for (const stop of stops) {
    const delivery = deliveries.get(stop.deliveryId);
    if (!delivery) continue;
    const point = stop.kind === "PICKUP" && delivery.pickup ? delivery.pickup : delivery.destination;
    if (position) clock += options.travelSeconds(position, point) * 1000;
    let waitSeconds = 0;
    if (stop.kind === "DROPOFF") {
      if (delivery.windowStart !== null && clock < delivery.windowStart) {
        waitSeconds = Math.round((delivery.windowStart - clock) / 1000);
        clock = delivery.windowStart;
      }
      if (delivery.windowEnd !== null && clock > delivery.windowEnd) {
        violations.push({ code: "SLOT_MISSED", deliveryId: delivery.id, lateMinutes: Math.ceil((clock - delivery.windowEnd) / 60_000) });
      }
      if (delivery.pickup && !pickedUp.has(delivery.id)) violations.push({ code: "PICKUP_AFTER_DROPOFF", deliveryId: delivery.id });
      load -= delivery.weightKg ?? 0;
    } else {
      pickedUp.add(delivery.id);
      load += delivery.weightKg ?? 0;
      maxLoad = Math.max(maxLoad, load);
    }
    evaluated.push({ ...stop, arrivalAt: clock, waitSeconds });
    clock += options.stopSeconds * 1000;
    position = point;
  }

  for (const id of ids) {
    if (!driver.eligibleDeliveryIds.has(id)) violations.push({ code: "NOT_ELIGIBLE", deliveryId: id });
  }
  if (driver.capacityKg !== null && maxLoad > driver.capacityKg) {
    violations.push({ code: "CAPACITY_EXCEEDED", loadKg: maxLoad, capacityKg: driver.capacityKg });
  }
  const durationSeconds = Math.round((clock - startedAt) / 1000);
  if (durationSeconds > options.maxDaySeconds) {
    violations.push({ code: "DAY_EXCEEDED", minutes: Math.ceil(durationSeconds / 60), maxMinutes: Math.floor(options.maxDaySeconds / 60) });
  }
  if (ids.length > options.maxDeliveries) violations.push({ code: "TOO_MANY_DELIVERIES", count: ids.length, max: options.maxDeliveries });

  return { stops: evaluated, durationSeconds, maxLoadKg: maxLoad, unknownWeightCount: known.filter((delivery) => delivery.weightKg === null).length, violations };
}

function byUrgency(a: RoundDelivery, b: RoundDelivery) {
  if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
  const left = a.windowEnd ?? Number.POSITIVE_INFINITY;
  const right = b.windowEnd ?? Number.POSITIVE_INFINITY;
  return left - right || a.id.localeCompare(b.id);
}

/** Chaque position d'insertion ; le retrait reste avant la livraison. */
function* insertions(stops: RoundStop[], delivery: RoundDelivery): Generator<RoundStop[]> {
  const dropoff: RoundStop = { deliveryId: delivery.id, kind: "DROPOFF" };
  if (!delivery.pickup) {
    for (let at = 0; at <= stops.length; at += 1) yield [...stops.slice(0, at), dropoff, ...stops.slice(at)];
    return;
  }
  const pickup: RoundStop = { deliveryId: delivery.id, kind: "PICKUP" };
  for (let first = 0; first <= stops.length; first += 1) {
    for (let second = first; second <= stops.length; second += 1) {
      yield [...stops.slice(0, first), pickup, ...stops.slice(first, second), dropoff, ...stops.slice(second)];
    }
  }
}

const REASON_ORDER: UnplannedReason[] = ["SLOT_MISSED", "CAPACITY_EXCEEDED", "DAY_EXCEEDED", "TOO_MANY_DELIVERIES"];

/** Propose les tournées. Une livraison qui ne tient nulle part reste à affecter, avec sa raison. */
export function planRounds(deliveries: RoundDelivery[], drivers: RoundDriver[], options: RoundOptions): RoundPlan {
  const byId = new Map(deliveries.map((delivery) => [delivery.id, delivery]));
  const orderedDrivers = [...drivers].sort((a, b) => a.id.localeCompare(b.id));
  const current = new Map(orderedDrivers.map((driver) => [driver.id, { stops: [] as RoundStop[], duration: 0 }]));
  const unplanned: RoundPlan["unplanned"] = [];

  for (const delivery of [...deliveries].sort(byUrgency)) {
    let best: { driverId: string; stops: RoundStop[]; duration: number; cost: number } | null = null;
    const seen = new Set<RoundViolation["code"]>();
    let eligible = false;
    for (const driver of orderedDrivers) {
      if (!driver.eligibleDeliveryIds.has(delivery.id)) continue;
      eligible = true;
      const round = current.get(driver.id)!;
      for (const stops of insertions(round.stops, delivery)) {
        const evaluation = evaluateRound(driver, stops, byId, options);
        if (evaluation.violations.length > 0) {
          for (const violation of evaluation.violations) seen.add(violation.code);
          continue;
        }
        // Temps ajouté à la tournée, et l'attente d'un livreur déjà occupé : les voisines se regroupent.
        const busySeconds = Math.max(0, driver.readyAt - options.now) / 1000;
        const cost = evaluation.durationSeconds - round.duration + (round.stops.length === 0 ? busySeconds : 0);
        if (!best || cost < best.cost) best = { driverId: driver.id, stops, duration: evaluation.durationSeconds, cost };
      }
    }
    if (best) {
      current.set(best.driverId, { stops: best.stops, duration: best.duration });
    } else {
      const reason = REASON_ORDER.find((code) => seen.has(code as RoundViolation["code"]));
      unplanned.push({ deliveryId: delivery.id, reason: !eligible || !reason ? "NO_ELIGIBLE_DRIVER" : reason });
    }
  }

  const rounds = orderedDrivers
    .filter((driver) => current.get(driver.id)!.stops.length > 0)
    .map((driver) => ({ driverId: driver.id, evaluation: evaluateRound(driver, current.get(driver.id)!.stops, byId, options) }));
  return { rounds, unplanned };
}
