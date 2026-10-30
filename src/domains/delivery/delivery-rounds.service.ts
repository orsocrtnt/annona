import { randomUUID } from "node:crypto";
import { getCompanyDispatchSettings } from "@/domains/company/dispatch-settings.service";
import { getCompanyTariffSettings } from "@/domains/company/tariff-settings.service";
import { assignDeliveryToDriver, getCompanyDriversWithActivity } from "@/domains/delivery/delivery.service";
import { parisInstant, parisToday } from "@/domains/order-intake/order-intake.deadline";
import { assertSaasMutationFeature } from "@/domains/saas/saas.service";
import { trackingService } from "@/domains/tracking/tracking.policy";
import { getDriverEligibilityReasons, splitEligibilityReasons } from "@/lib/dispatch/driver-eligibility";
import {
  evaluateRound,
  planRounds,
  stopsForDelivery,
  type RoundDelivery,
  type RoundDriver,
  type RoundEvaluation,
  type RoundOptions,
  type RoundStop,
  type RoundViolation,
  type UnplannedReason,
} from "@/lib/dispatch/round-planner";
import { estimateTravelMatrix, type GeoPoint } from "@/lib/dispatch/travel-time";
import { formatDriverDisplayName } from "@/lib/format/person-labels";
import { geocodeManyCapped } from "@/lib/geocoding";
import { getDispatchDriverRule } from "@/lib/validations/dispatch-settings";
import { prisma } from "@/services/prisma/client";

/** Plafond du calcul : au-delà, le reste attend le passage suivant. */
const ROUND_PENDING_TAKE = 200;
/** Temps supposé pour finir une mission déjà en cours avant de commencer la tournée. */
const BUSY_SECONDS_PER_ACTIVE_MISSION = 15 * 60;
export const ROUND_ASSIGNMENT_REASON = "Tournée validée par le dispatch";
export const ROUND_AUTO_ASSIGNMENT_REASON = "Tournée automatique";

export type RoundUnplannedReason = UnplannedReason | "NOT_LOCATED" | "MULTI_PICKUP";

const pendingSelect = {
  id: true,
  reference: true,
  address: true,
  city: true,
  postalCode: true,
  pickupAddress: true,
  pickupCity: true,
  pickupPostalCode: true,
  latitude: true,
  longitude: true,
  pickupLatitude: true,
  pickupLongitude: true,
  deliveryCategory: true,
  updatedAt: true,
  order: {
    select: {
      requestedDeliveryDate: true,
      deliverySlotStart: true,
      weightKg: true,
      stops: { orderBy: { sequence: "asc" as const }, select: { latitude: true, longitude: true } },
    },
  },
};

async function loadRoundContext(companyId: string, now: Date) {
  const [settings, tariffSettings, drivers, pending] = await Promise.all([
    getCompanyDispatchSettings(companyId),
    getCompanyTariffSettings(companyId),
    getCompanyDriversWithActivity(companyId, { withDispatchPosition: true }),
    prisma.delivery.findMany({
      where: {
        companyId,
        status: "PENDING",
        driverId: null,
        deliveryCategory: { in: ["STANDARD", "COURIER"] },
        order: { status: { notIn: ["CANCELLED", "DELIVERED", "FAILED", "INVOICED", "PAID"] } },
      },
      select: pendingSelect,
      orderBy: { createdAt: "asc" },
      take: ROUND_PENDING_TAKE,
    }),
  ]);

  // Coordonnées manquantes : même géocodage plafonné que la carte du dispatch.
  const missing = pending.flatMap((delivery) => [
    ...(delivery.latitude == null || delivery.longitude == null
      ? [{ key: `${delivery.id}-dest`, parts: { address: delivery.address, postalCode: delivery.postalCode, city: delivery.city } }]
      : []),
    ...(delivery.deliveryCategory === "COURIER" && delivery.pickupAddress && delivery.pickupLatitude == null && delivery.order.stops.length === 0
      ? [{ key: `${delivery.id}-pickup`, parts: { address: delivery.pickupAddress, postalCode: delivery.pickupPostalCode, city: delivery.pickupCity } }]
      : []),
  ]);
  const geocoded = await geocodeManyCapped(missing);
  const located = (key: string): GeoPoint | null => {
    const found = geocoded.get(key);
    return found ? { latitude: found.lat, longitude: found.lng } : null;
  };

  const today = parisToday(now).date;
  const endOfToday = parisInstant(today, "23:59");
  const deliveries: RoundDelivery[] = [];
  const rejected: Array<{ deliveryId: string; reason: RoundUnplannedReason }> = [];
  let laterCount = 0;

  for (const delivery of pending) {
    const requested = delivery.order.requestedDeliveryDate;
    if (requested && parisToday(requested).date > today) {
      laterCount += 1;
      continue;
    }
    if (delivery.order.stops.length > 1) {
      rejected.push({ deliveryId: delivery.id, reason: "MULTI_PICKUP" });
      continue;
    }
    const destination = delivery.latitude != null && delivery.longitude != null
      ? { latitude: delivery.latitude, longitude: delivery.longitude }
      : located(`${delivery.id}-dest`);
    const stop = delivery.order.stops[0];
    const pickup = delivery.deliveryCategory !== "COURIER"
      ? null
      : stop?.latitude != null && stop.longitude != null
        ? { latitude: stop.latitude, longitude: stop.longitude }
        : delivery.pickupLatitude != null && delivery.pickupLongitude != null
          ? { latitude: delivery.pickupLatitude, longitude: delivery.pickupLongitude }
          : located(`${delivery.id}-pickup`);
    if (!destination || (delivery.deliveryCategory === "COURIER" && !pickup)) {
      rejected.push({ deliveryId: delivery.id, reason: "NOT_LOCATED" });
      continue;
    }
    const slotStart = delivery.order.deliverySlotStart;
    // Sans créneau, une livraison demandée pour aujourd'hui doit partir avant la fin de la journée.
    const dueAt = slotStart ? requested : requested ? endOfToday : null;
    const late = Boolean(requested && (slotStart ? requested < now : parisToday(requested).date < today));
    deliveries.push({
      id: delivery.id,
      destination,
      pickup,
      weightKg: delivery.order.weightKg == null ? null : Number(delivery.order.weightKg),
      windowStart: !late && slotStart ? slotStart.getTime() : null,
      windowEnd: !late && dueAt ? dueAt.getTime() : null,
      urgent: late,
    });
  }

  const nowMs = now.getTime();
  const maxAgeMs = settings.gpsPositionMaxAgeMinutes * 60_000;
  const roundDrivers: RoundDriver[] = drivers.map((driver) => {
    const location = driver.driverLocation;
    const fresh = trackingService(driver.settings).active && location && nowMs - location.updatedAt.getTime() <= maxAgeMs;
    const eligibleDeliveryIds = new Set(
      pending
        .filter((delivery) => {
          const reasons = getDriverEligibilityReasons(
            driver,
            { deliveryCategory: delivery.deliveryCategory, postalCode: delivery.postalCode, pickupPostalCode: delivery.pickupPostalCode },
            settings,
            tariffSettings.tariffZones
          );
          // Le plafond de charge (règle souple) ne limite pas une tournée : elle a sa propre limite.
          return splitEligibilityReasons(reasons).hard.length === 0;
        })
        .map((delivery) => delivery.id)
    );
    return {
      id: driver.id,
      start: fresh ? { latitude: location.latitude, longitude: location.longitude } : null,
      readyAt: nowMs + (driver.assigned + driver.inTransit) * BUSY_SECONDS_PER_ACTIVE_MISSION * 1000,
      capacityKg: getDispatchDriverRule(settings, driver.id)?.vehicleCapacityKg ?? null,
      eligibleDeliveryIds,
    };
  });

  const points = [
    ...roundDrivers.flatMap((driver) => (driver.start ? [driver.start] : [])),
    ...deliveries.flatMap((delivery) => [delivery.destination, ...(delivery.pickup ? [delivery.pickup] : [])]),
  ];
  const matrix = await estimateTravelMatrix(points);
  const options: RoundOptions = {
    now: nowMs,
    stopSeconds: settings.rounds.stopMinutes * 60,
    maxDaySeconds: settings.rounds.dayMinutes * 60,
    maxDeliveries: settings.rounds.maxDeliveries,
    travelSeconds: matrix.seconds,
  };
  return { settings, drivers, pending, deliveries, rejected, laterCount, roundDrivers, options, approximate: matrix.approximate };
}

type RoundContext = Awaited<ReturnType<typeof loadRoundContext>>;

const addressLine = (parts: Array<string | null | undefined>) => parts.filter(Boolean).join(", ");

/** Réponse au dispatcher : adresses et horaires, aucune coordonnée. */
function presentRound(context: RoundContext, driverId: string, evaluation: RoundEvaluation) {
  const pendingById = new Map(context.pending.map((delivery) => [delivery.id, delivery]));
  const driver = context.drivers.find((candidate) => candidate.id === driverId);
  const roundDriver = context.roundDrivers.find((candidate) => candidate.id === driverId);
  return {
    driverId,
    driverName: driver ? formatDriverDisplayName(`${driver.firstName} ${driver.lastName}`) : "",
    startKnown: Boolean(roundDriver?.start),
    capacityKg: roundDriver?.capacityKg ?? null,
    approximate: context.approximate,
    durationMinutes: Math.ceil(evaluation.durationSeconds / 60),
    maxLoadKg: evaluation.maxLoadKg,
    unknownWeightCount: evaluation.unknownWeightCount,
    violations: evaluation.violations.map((violation) => ({
      ...violation,
      reference: "deliveryId" in violation ? pendingById.get(violation.deliveryId)?.reference ?? null : null,
    })),
    stops: evaluation.stops.map((stop) => {
      const delivery = pendingById.get(stop.deliveryId)!;
      return {
        deliveryId: stop.deliveryId,
        kind: stop.kind,
        reference: delivery.reference,
        address: stop.kind === "PICKUP"
          ? addressLine([delivery.pickupAddress, delivery.pickupPostalCode, delivery.pickupCity])
          : addressLine([delivery.address, delivery.postalCode, delivery.city]),
        arrivalAt: new Date(stop.arrivalAt).toISOString(),
        waitMinutes: Math.ceil(stop.waitSeconds / 60),
        slot: delivery.order.deliverySlotStart && delivery.order.requestedDeliveryDate
          ? { start: delivery.order.deliverySlotStart.toISOString(), end: delivery.order.requestedDeliveryDate.toISOString() }
          : null,
        weightKg: delivery.order.weightKg == null ? null : Number(delivery.order.weightKg),
      };
    }),
  };
}

export type PresentedRound = ReturnType<typeof presentRound>;

async function getActiveRounds(companyId: string) {
  const rows = await prisma.delivery.findMany({
    where: { companyId, roundId: { not: null }, status: { in: ["ASSIGNED", "PURCHASING", "IN_DELIVERY"] } },
    select: { id: true, reference: true, address: true, city: true, status: true, roundId: true, roundSequence: true, driverName: true },
    orderBy: [{ roundId: "asc" }, { roundSequence: "asc" }],
    take: ROUND_PENDING_TAKE,
  });
  const groups = new Map<string, { roundId: string; driverName: string; deliveries: Array<{ id: string; reference: string; address: string; status: string }> }>();
  for (const row of rows) {
    const group = groups.get(row.roundId!) ?? { roundId: row.roundId!, driverName: formatDriverDisplayName(row.driverName), deliveries: [] };
    group.deliveries.push({ id: row.id, reference: row.reference, address: addressLine([row.address, row.city]), status: row.status });
    groups.set(row.roundId!, group);
  }
  return [...groups.values()];
}

export async function getRoundProposals(companyId: string, now = new Date()) {
  const context = await loadRoundContext(companyId, now);
  const plan = planRounds(context.deliveries, context.roundDrivers, context.options);
  const pendingById = new Map(context.pending.map((delivery) => [delivery.id, delivery]));
  return {
    rounds: plan.rounds.map((round) => presentRound(context, round.driverId, round.evaluation)),
    unplanned: [...plan.unplanned, ...context.rejected].map((item) => {
      const delivery = pendingById.get(item.deliveryId)!;
      return { deliveryId: item.deliveryId, reference: delivery.reference, address: addressLine([delivery.address, delivery.city]), reason: item.reason };
    }),
    laterCount: context.laterCount,
    active: await getActiveRounds(companyId),
    drivers: context.drivers.map((driver) => ({ id: driver.id, name: formatDriverDisplayName(`${driver.firstName} ${driver.lastName}`) })),
  };
}

export type RoundProposals = Awaited<ReturnType<typeof getRoundProposals>>;

/** Chaque livraison a tous ses arrêts, une seule fois : une requête forgée ne passe pas. */
export function isCompleteRound(stops: RoundStop[], deliveries: ReadonlyMap<string, RoundDelivery>): boolean {
  if (stops.length === 0) return false;
  const seen = new Set(stops.map((stop) => `${stop.deliveryId}:${stop.kind}`));
  if (seen.size !== stops.length) return false;
  const ids = new Set(stops.map((stop) => stop.deliveryId));
  return [...ids].every((id) => {
    const delivery = deliveries.get(id);
    return Boolean(delivery) && stopsForDelivery(delivery!).every((stop) => seen.has(`${stop.deliveryId}:${stop.kind}`));
  });
}

export function dropoffOrder(stops: RoundStop[]): string[] {
  return stops.filter((stop) => stop.kind === "DROPOFF").map((stop) => stop.deliveryId);
}

export class RoundRejectedError extends Error {
  constructor(code: "ROUND_INVALID" | "DRIVER_NOT_FOUND") {
    super(code);
  }
}

/** Recalcule une tournée modifiée par le dispatcher ; le navigateur n'est jamais cru. */
export async function previewRound(companyId: string, driverId: string, stops: RoundStop[], now = new Date()) {
  const context = await loadRoundContext(companyId, now);
  const driver = context.roundDrivers.find((candidate) => candidate.id === driverId);
  if (!driver) throw new RoundRejectedError("DRIVER_NOT_FOUND");
  const byId = new Map(context.deliveries.map((delivery) => [delivery.id, delivery]));
  if (!isCompleteRound(stops, byId)) throw new RoundRejectedError("ROUND_INVALID");
  const evaluation = evaluateRound(driver, stops, byId, context.options);
  return { round: presentRound(context, driverId, evaluation), evaluation };
}

type RoundAssignOptions = { automatic?: boolean };

/** Une transaction courte par livraison : un conflit sur l'une n'annule pas les autres. */
async function assignInOrder(companyId: string, driverId: string, deliveryIds: string[], options: RoundAssignOptions = {}) {
  const roundId = randomUUID();
  const assigned: string[] = [];
  const failed: Array<{ deliveryId: string; code: string }> = [];
  for (const [index, deliveryId] of deliveryIds.entries()) {
    try {
      await assignDeliveryToDriver(companyId, deliveryId, driverId, {
        automatic: options.automatic,
        reason: options.automatic ? ROUND_AUTO_ASSIGNMENT_REASON : ROUND_ASSIGNMENT_REASON,
        expectUnassigned: true,
        force: true,
        round: { id: roundId, sequence: index + 1 },
      });
      assigned.push(deliveryId);
    } catch (error) {
      failed.push({ deliveryId, code: error instanceof Error ? error.message.split(":")[0]! : "ROUND_ASSIGN_FAILED" });
    }
  }
  return { roundId, assigned, failed };
}

/**
 * Validation par le dispatcher. Une limite dépassée est refusée tant qu'il ne l'a pas acceptée ;
 * une règle dure (zone, catégorie, livreur en pause) reste refusée par l'affectation elle-même.
 */
export async function validateRound(companyId: string, driverId: string, stops: RoundStop[], acceptViolations: boolean, now = new Date()) {
  const { round, evaluation } = await previewRound(companyId, driverId, stops, now);
  const blocking = evaluation.violations.filter((violation: RoundViolation) => violation.code !== "NOT_ELIGIBLE");
  if (blocking.length > 0 && !acceptViolations) return { status: "NEEDS_CONFIRMATION" as const, round };
  return { status: "DONE" as const, round, ...(await assignInOrder(companyId, driverId, dropoffOrder(stops))) };
}

/** Mode automatique (C12) : les tournées proposées sont affectées sans validation. */
export async function runAutoRounds(companyId: string, now = new Date()) {
  const context = await loadRoundContext(companyId, now);
  const plan = planRounds(context.deliveries, context.roundDrivers, context.options);
  let assigned = 0;
  let failed = 0;
  for (const round of plan.rounds) {
    const result = await assignInOrder(companyId, round.driverId, dropoffOrder(round.evaluation.stops), { automatic: true });
    assigned += result.assigned.length;
    failed += result.failed.length;
  }
  return { assigned, skipped: failed + plan.unplanned.length + context.rejected.length };
}

/** Passage du filet cron : seules les entreprises en mode tournées automatiques sont traitées. */
export async function runDueAutoRounds() {
  const companies = await prisma.delivery.findMany({
    where: { status: "PENDING", driverId: null },
    distinct: ["companyId"],
    select: { companyId: true },
    take: 100,
  });
  let assigned = 0;
  for (const { companyId } of companies) {
    const settings = await getCompanyDispatchSettings(companyId);
    if (!settings.enabled || !settings.rounds.autoAssign) continue;
    try {
      await assertSaasMutationFeature(companyId, "auto_dispatch");
      assigned += (await runAutoRounds(companyId)).assigned;
    } catch (error) {
      console.warn("[auto-rounds]", companyId, error instanceof Error ? error.message : "ROUND_FAILED");
    }
  }
  return { assigned };
}
