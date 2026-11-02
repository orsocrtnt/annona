import type { DeliveryCategory } from "@prisma/client";
import { prisma } from "@/services/prisma/client";
import { getCompanyDispatchSettings } from "@/domains/company/dispatch-settings.service";
import {
  getCompanyTariffSettings,
} from "@/domains/company/tariff-settings.service";
import { findTariffZoneForPostalCode } from "@/lib/tariff/find-tariff-zone";
import {
  assignDeliveryToDriver,
  getCompanyDriversWithActivity,
} from "@/domains/delivery/delivery.service";
import {
  activeLoad,
  getDispatchPostalCode,
  getDriverEligibilityReasons,
  isDriverEligibleForDelivery,
  maxForDriver,
  type DeliveryForEligibility,
} from "@/lib/dispatch/driver-eligibility";
import type {
  CompanyDispatchSettings,
  DispatchDriverRule,
} from "@/lib/validations/dispatch-settings";
import { AUTO_DISPATCH_QUEUE_TAKE } from "@/lib/query/list-limits";
import { getDispatchDriverRule } from "@/lib/validations/dispatch-settings";
import {
  compareDispatchProximity,
  computeDispatchProximity,
  getDispatchPickupPoint,
  type DispatchProximity,
} from "@/lib/dispatch/dispatch-proximity";
import { trackingService } from "@/domains/tracking/tracking.policy";
import {
  BEST_SCORE_HISTORY_REASON,
  SUGGESTION_HISTORY_REASON,
  rankDispatchCandidates,
  type RankedCandidate,
  type ScoreCandidate,
} from "@/lib/dispatch/dispatch-score";
import { estimateTravelTimes, type TravelEstimate } from "@/lib/dispatch/travel-time";

type DriverActivity = Awaited<ReturnType<typeof getCompanyDriversWithActivity>>[number];

type DeliveryForDispatch = DeliveryForEligibility & {
  id: string;
  driverId: string | null;
  status: string;
  createdAt: Date;
  pickupLatitude?: number | null;
  pickupLongitude?: number | null;
};

type Proximities = ReadonlyMap<string, DispatchProximity>;
type TravelTimes = ReadonlyMap<string, TravelEstimate>;
type TariffZones = Awaited<ReturnType<typeof getCompanyTariffSettings>>["tariffZones"];

export const AUTO_ROUND_WAIT_REASON = "En attente de la prochaine tournée automatique";

export type AutoDispatchResult = {
  deliveryId: string;
  assigned: boolean;
  driverId?: string;
  reason?: string;
  skippedReason?: string;
};

/** Sans chiffre : la raison est recopiée dans l'historique, visible du client. */
const PROXIMITY_REASON = "plus proche du point de retrait";

function proximityDecided<T extends { id: string }>(
  sorted: T[],
  proximities: Proximities,
  sameBeforeProximity: (a: T, b: T) => boolean
): boolean {
  const [first, second] = sorted;
  if (!first || !second || !sameBeforeProximity(first, second)) return false;
  return compareDispatchProximity(proximities.get(first.id), proximities.get(second.id)) < 0;
}

function priorityForDriver(
  driverId: string,
  rules: DispatchDriverRule[]
): number | null {
  const rule = rules.find((r) => r.driverId === driverId);
  return rule?.priority ?? null;
}

function strategyLabel(strategy: CompanyDispatchSettings["strategy"]): string {
  const labels = {
    PRIORITY_LIST: "liste de priorité",
    LEAST_LOADED: "moins chargé",
    ZONE_THEN_PRIORITY: "zone géographique",
  } as const;
  return labels[strategy];
}

function filterEligibleDrivers(
  drivers: DriverActivity[],
  delivery: DeliveryForDispatch,
  settings: CompanyDispatchSettings,
  tariffZones: Awaited<ReturnType<typeof getCompanyTariffSettings>>["tariffZones"]
): DriverActivity[] {
  return drivers.filter((driver) =>
    isDriverEligibleForDelivery(driver, delivery, settings, tariffZones)
  );
}

function pickByPriorityList(
  drivers: DriverActivity[],
  settings: CompanyDispatchSettings,
  category: DeliveryCategory,
  proximities: Proximities
): { driverId: string; reason: string } | null {
  if (drivers.length === 0) return null;

  const rules = [...settings.driverRules].sort((a, b) => a.priority - b.priority);

  if (rules.length > 0) {
    // Priorité explicite d'abord ; la distance ne départage que des priorités égales.
    const ranked = rules
      .map((rule, index) => ({ rule, index, driver: drivers.find((d) => d.id === rule.driverId) }))
      .filter((item): item is typeof item & { driver: DriverActivity } => Boolean(item.driver))
      .map((item) => ({ ...item, id: item.driver.id }));
    const sorted = ranked.sort(
      (a, b) =>
        a.rule.priority - b.rule.priority ||
        compareDispatchProximity(proximities.get(a.id), proximities.get(b.id)) ||
        a.index - b.index
    );
    const picked = sorted[0];
    if (!picked) return null;
    const base = `Priorité ${picked.rule.priority} (${strategyLabel("PRIORITY_LIST")})`;
    return {
      driverId: picked.driver.id,
      reason: proximityDecided(sorted, proximities, (a, b) => a.rule.priority === b.rule.priority)
        ? `${base} · ${PROXIMITY_REASON}`
        : base,
    };
  }

  const courierPriority = (driver: DriverActivity) =>
    settings.prioritizeCourier && category === "COURIER"
      ? priorityForDriver(driver.id, settings.driverRules) ?? 999
      : 0;
  const sorted = [...drivers].sort(
    (a, b) =>
      courierPriority(a) - courierPriority(b) ||
      activeLoad(a) - activeLoad(b) ||
      // Départage seulement : priorité et charge sont égales.
      compareDispatchProximity(proximities.get(a.id), proximities.get(b.id))
  );

  const picked = sorted[0]!;
  const base = `Livreur le moins chargé (${activeLoad(picked)} active(s))`;
  return {
    driverId: picked.id,
    reason: proximityDecided(
      sorted,
      proximities,
      (a, b) => courierPriority(a) === courierPriority(b) && activeLoad(a) === activeLoad(b)
    )
      ? `${base} · ${PROXIMITY_REASON}`
      : base,
  };
}

function pickByLeastLoaded(
  drivers: DriverActivity[],
  settings: CompanyDispatchSettings,
  category: DeliveryCategory,
  proximities: Proximities
): { driverId: string; reason: string } | null {
  if (drivers.length === 0) return null;

  // Avec ou sans priorisation des courses, le départage d'origine est la priorité réglée.
  const rulePriority = (driver: DriverActivity) =>
    priorityForDriver(driver.id, settings.driverRules) ?? 999;
  const sorted = [...drivers].sort((a, b) => {
    const loadDiff = activeLoad(a) - activeLoad(b);
    if (loadDiff !== 0) return loadDiff;

    const priorityDiff = rulePriority(a) - rulePriority(b);
    if (priorityDiff !== 0) return priorityDiff;

    // Départage seulement : charge et priorité réglée sont égales.
    return compareDispatchProximity(proximities.get(a.id), proximities.get(b.id));
  });

  const picked = sorted[0]!;
  const base = `Moins chargé : ${activeLoad(picked)} livraison(s) active(s)`;
  return {
    driverId: picked.id,
    reason: proximityDecided(
      sorted,
      proximities,
      (a, b) => activeLoad(a) === activeLoad(b) && rulePriority(a) === rulePriority(b)
    )
      ? `${base} · ${PROXIMITY_REASON}`
      : base,
  };
}

function pickByZoneThenPriority(
  drivers: DriverActivity[],
  settings: CompanyDispatchSettings,
  delivery: DeliveryForDispatch,
  tariffZones: Awaited<ReturnType<typeof getCompanyTariffSettings>>["tariffZones"],
  proximities: Proximities
): { driverId: string; reason: string } | null {
  const postalCode = getDispatchPostalCode(delivery);
  const zone = findTariffZoneForPostalCode(postalCode, tariffZones);
  if (zone) {
    const zoneDriverId = settings.zoneDriverMap[zone.id];
    if (zoneDriverId) {
      const zoneDriver = drivers.find((d) => d.id === zoneDriverId);
      if (zoneDriver) {
        return {
          driverId: zoneDriver.id,
          reason: `Zone « ${zone.name} »`,
        };
      }
    }
  }

  const fallback = pickByPriorityList(drivers, settings, delivery.deliveryCategory, proximities);
  if (fallback) {
    return {
      ...fallback,
      reason: zone
        ? `Zone « ${zone.name} » indisponible — ${fallback.reason}`
        : fallback.reason,
    };
  }
  return null;
}

/**
 * Candidats notés (DISPATCH-4) : seuls les livreurs éligibles, avec leur charge, zone,
 * priorité et trajet connu. Les livreurs sans trajet restent candidats, notés neutres.
 */
export function buildScoreCandidates(
  eligible: DriverActivity[],
  delivery: DeliveryForDispatch,
  settings: CompanyDispatchSettings,
  tariffZones: TariffZones,
  proximities: Proximities,
  travel: TravelTimes
): ScoreCandidate[] {
  const zone = findTariffZoneForPostalCode(getDispatchPostalCode(delivery), tariffZones);
  const preferredId = zone ? settings.zoneDriverMap[zone.id] : undefined;
  return eligible.map((driver) => {
    const rule = getDispatchDriverRule(settings, driver.id);
    const restricted = Boolean(rule && (rule.zoneIds.length > 0 || rule.postalCodePrefixes.length > 0));
    return {
      id: driver.id,
      load: activeLoad(driver),
      maxLoad: maxForDriver(driver.id, settings),
      priority: rule?.priority ?? null,
      zone: preferredId === driver.id ? "PREFERRED" : restricted ? "COVERED" : "ANY",
      zoneName: zone?.name ?? null,
      travel: travel.get(driver.id) ?? null,
      positionStatus: proximities.get(driver.id)?.status ?? "NO_POSITION",
    };
  });
}

/** Livreurs éligibles classés par score (DISPATCH-4), sans aucun appel réseau. */
export function rankEligibleDrivers(
  delivery: DeliveryForDispatch,
  settings: CompanyDispatchSettings,
  drivers: DriverActivity[],
  tariffZones: TariffZones,
  proximities: Proximities = new Map(),
  travel: TravelTimes = new Map()
): RankedCandidate[] {
  const eligible = filterEligibleDrivers(drivers, delivery, settings, tariffZones);
  return rankDispatchCandidates(
    buildScoreCandidates(eligible, delivery, settings, tariffZones, proximities, travel)
  );
}

export function resolveDriverForDelivery(
  delivery: DeliveryForDispatch,
  settings: CompanyDispatchSettings,
  drivers: DriverActivity[],
  tariffZones: Awaited<ReturnType<typeof getCompanyTariffSettings>>["tariffZones"],
  proximities: Proximities = new Map(),
  travel: TravelTimes = new Map()
): { driverId: string; reason: string } | null {
  if (delivery.driverId) return null;
  if (delivery.status !== "PENDING") return null;

  const categoryEnabled =
    delivery.deliveryCategory === "COURIER"
      ? settings.autoAssignCategories.COURIER
      : delivery.deliveryCategory === "SPECIAL_MISSION"
        ? settings.autoAssignCategories.SPECIAL_MISSION
        : settings.autoAssignCategories.STANDARD;
  if (!categoryEnabled) return null;

  const eligible = filterEligibleDrivers(drivers, delivery, settings, tariffZones);
  if (eligible.length === 0) return null;

  let pick: { driverId: string; reason: string } | null = null;

  if (settings.bestScore) {
    const best = rankDispatchCandidates(
      buildScoreCandidates(eligible, delivery, settings, tariffZones, proximities, travel)
    )[0];
    pick = best ? { driverId: best.id, reason: BEST_SCORE_HISTORY_REASON } : null;
  } else switch (settings.strategy) {
    case "LEAST_LOADED":
      pick = pickByLeastLoaded(eligible, settings, delivery.deliveryCategory, proximities);
      break;
    case "ZONE_THEN_PRIORITY":
      pick = pickByZoneThenPriority(eligible, settings, delivery, tariffZones, proximities);
      break;
    case "PRIORITY_LIST":
    default:
      pick = pickByPriorityList(eligible, settings, delivery.deliveryCategory, proximities);
      break;
  }

  if (pick) return pick;

  if (settings.defaultDriverId) {
    const defaultDriver = eligible.find((d) => d.id === settings.defaultDriverId);
    if (defaultDriver) {
      return {
        driverId: defaultDriver.id,
        reason: "Livreur par défaut",
      };
    }
  }

  return null;
}

type DriverDispatchPosition = {
  settings?: unknown;
  driverLocation?: { latitude: number; longitude: number; updatedAt: Date } | null;
};
type DriverWithDispatchPosition = DriverActivity & DriverDispatchPosition;

/**
 * Un passage de file : les positions sont lues une fois, la charge à chaque livraison.
 * `routeCallsLeft` borne les appels au service de trajet sur toute la file.
 */
export type AutoDispatchPass = {
  /** Proposition sans affectation : charge déjà promise à chaque livreur par les lignes précédentes. */
  plannedLoad?: Map<string, { assigned: number; byCategory: Partial<Record<DeliveryCategory, number>> }>;
  positions?: Map<string, DriverDispatchPosition>;
  routeCallsLeft?: number;
  routeStartedAt?: number;
};

/** Plafond d'appels `table` par passage de file (au plus un par livraison)… */
export const ROUTE_CALLS_PER_PASS = 20;
/** …et durée totale au-delà de laquelle la file passe au vol d'oiseau (OSRM lent). */
export const ROUTE_TIME_BUDGET_MS = 10_000;

/** Seuls les livreurs en service ont une position utilisée ; le reste est neutre. */
function proximitiesFromDrivers(
  delivery: DeliveryForDispatch,
  drivers: DriverWithDispatchPosition[],
  settings: CompanyDispatchSettings,
  now = new Date()
): Map<string, DispatchProximity> {
  const pickup = getDispatchPickupPoint(delivery);
  return new Map(
    drivers.map((driver) => [
      driver.id,
      computeDispatchProximity({
        settings,
        pickup,
        onDuty: trackingService(driver.settings).active,
        position: driver.driverLocation ?? null,
        now,
      }),
    ])
  );
}

/**
 * Temps de trajet des livreurs éligibles positionnés (en service, position récente, retrait
 * connu). Un seul appel `table` au plus, toujours hors transaction ; repli à vol d'oiseau.
 */
export async function computeTravelTimes(
  delivery: DeliveryForDispatch,
  eligibleIds: ReadonlySet<string>,
  drivers: DriverWithDispatchPosition[],
  proximities: Proximities,
  pass?: AutoDispatchPass
): Promise<Map<string, TravelEstimate>> {
  const pickup = getDispatchPickupPoint(delivery);
  if (!pickup) return new Map();
  const origins = drivers.flatMap((driver) => {
    const status = proximities.get(driver.id)?.status;
    const position = driver.driverLocation;
    if (!eligibleIds.has(driver.id) || !position || (status !== "NEAR" && status !== "FAR")) return [];
    return [{ id: driver.id, point: { latitude: position.latitude, longitude: position.longitude } }];
  });
  if (origins.length === 0) return new Map();
  if (pass) pass.routeStartedAt ??= Date.now();
  const allowNetwork = pass
    ? (pass.routeCallsLeft ?? ROUTE_CALLS_PER_PASS) > 0 && Date.now() - pass.routeStartedAt! < ROUTE_TIME_BUDGET_MS
    : true;
  const { estimates, networkCalls } = await estimateTravelTimes(origins, pickup, { allowNetwork });
  if (pass) pass.routeCallsLeft = (pass.routeCallsLeft ?? ROUTE_CALLS_PER_PASS) - networkCalls;
  return estimates;
}

type AutoPick = { driverId: string; reason: string; driverName: string; category: DeliveryCategory };

/** Choix du livreur sans rien écrire ; `skippedReason` si aucune affectation n'est possible. */
async function pickAutoDriver(
  companyId: string,
  deliveryId: string,
  settings: Awaited<ReturnType<typeof getCompanyDispatchSettings>>,
  pass?: AutoDispatchPass
): Promise<{ pick: AutoPick } | { skippedReason: string }> {
  if (!settings.enabled) {
    return { skippedReason: "Auto-dispatch désactivé" };
  }
  // Tournées automatiques : la livraison attend le prochain passage, pour être regroupée.
  if (settings.rounds.autoAssign) {
    return { skippedReason: AUTO_ROUND_WAIT_REASON };
  }

  const delivery = await prisma.delivery.findFirst({
    where: { id: deliveryId, companyId },
    select: {
      id: true,
      postalCode: true,
      pickupPostalCode: true,
      pickupLatitude: true,
      pickupLongitude: true,
      deliveryCategory: true,
      driverId: true,
      status: true,
      createdAt: true,
    },
  });

  if (!delivery) {
    return { skippedReason: "Livraison introuvable" };
  }

  if (delivery.driverId) {
    return { skippedReason: "Déjà assignée" };
  }

  if (delivery.status !== "PENDING") {
    return { skippedReason: "Statut non éligible" };
  }

  // Positions lues avec la liste des livreurs, hors transaction (leçon DISPATCH-3),
  // sauf si le passage de file les a déjà lues.
  const readPositions = settings.gpsProximityEnabled && !pass?.positions;
  const [loaded, tariffSettings] = await Promise.all([
    readPositions
      ? getCompanyDriversWithActivity(companyId, { withDispatchPosition: true })
      : getCompanyDriversWithActivity(companyId),
    getCompanyTariffSettings(companyId),
  ]);
  const known = pass?.positions;
  const located: DriverWithDispatchPosition[] =
    !readPositions && known ? loaded.map((driver) => ({ ...driver, ...known.get(driver.id) })) : loaded;
  const drivers = located.map((driver) => withPlannedLoad(driver, pass?.plannedLoad?.get(driver.id)));
  if (readPositions && pass) {
    pass.positions = new Map(
      drivers.map((driver) => [driver.id, { settings: driver.settings, driverLocation: driver.driverLocation ?? null }])
    );
  }

  if (drivers.length === 0) {
    return { skippedReason: "Aucun livreur actif" };
  }

  const proximities = proximitiesFromDrivers(delivery, drivers, settings);
  // Meilleur score : trajet calculé ici, avant la transaction d'affectation.
  const travel =
    settings.bestScore
      ? await computeTravelTimes(
          delivery,
          new Set(filterEligibleDrivers(drivers, delivery, settings, tariffSettings.tariffZones).map((d) => d.id)),
          drivers,
          proximities,
          pass
        )
      : new Map<string, TravelEstimate>();
  const pick = resolveDriverForDelivery(
    delivery,
    settings,
    drivers,
    tariffSettings.tariffZones,
    proximities,
    travel
  );

  if (!pick) {
    return { skippedReason: "Aucun livreur compatible selon les règles" };
  }

  const chosen = drivers.find((driver) => driver.id === pick.driverId);
  return {
    pick: {
      driverId: pick.driverId,
      reason: pick.reason,
      driverName: chosen ? `${chosen.firstName} ${chosen.lastName}`.trim() : "",
      category: delivery.deliveryCategory,
    },
  };
}

function withPlannedLoad<T extends { assigned?: number; activeByCategory?: Partial<Record<DeliveryCategory, number>> }>(
  driver: T,
  planned?: { assigned: number; byCategory: Partial<Record<DeliveryCategory, number>> }
): T {
  if (!planned) return driver;
  const activeByCategory = { ...driver.activeByCategory };
  for (const [category, count] of Object.entries(planned.byCategory) as [DeliveryCategory, number][]) {
    activeByCategory[category] = (activeByCategory[category] ?? 0) + count;
  }
  return { ...driver, assigned: (driver.assigned ?? 0) + planned.assigned, activeByCategory };
}

export async function tryAutoAssignDelivery(
  companyId: string,
  deliveryId: string,
  pass?: AutoDispatchPass
): Promise<AutoDispatchResult> {
  const settings = await getCompanyDispatchSettings(companyId);
  const found = await pickAutoDriver(companyId, deliveryId, settings, pass);
  if ("skippedReason" in found) return { deliveryId, assigned: false, skippedReason: found.skippedReason };
  const { pick } = found;

  try {
    await assignDeliveryToDriver(companyId, deliveryId, pick.driverId, {
      automatic: true,
      reason: pick.reason,
      expectUnassigned: true,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "DELIVERY_ALREADY_ASSIGNED" ||
        error.message === "DELIVERY_NOT_AVAILABLE" ||
        error.message === "DELIVERY_ASSIGNMENT_CONFLICT" ||
        error.message === "DELIVERY_STATUS_CONFLICT" ||
        error.message === "DELIVERY_MISSION_STARTED" ||
        error.message === "DELIVERY_NOT_ASSIGNABLE")
    ) {
      return { deliveryId, assigned: false, skippedReason: "Déjà assignée entre-temps" };
    }
    throw error;
  }

  return {
    deliveryId,
    assigned: true,
    driverId: pick.driverId,
    reason: pick.reason,
  };
}

export async function runAutoDispatchQueue(companyId: string) {
  const settings = await getCompanyDispatchSettings(companyId);
  if (!settings.enabled) {
    return {
      assigned: 0,
      skipped: 0,
      results: [] as AutoDispatchResult[],
      // Mode « Suggestion » : aucune affectation sans validation du dispatcher.
      message: "Mode suggestion : validez les propositions livraison par livraison.",
    };
  }
  if (settings.rounds.autoAssign) {
    const { runAutoRounds } = await import("@/domains/delivery/delivery-rounds.service");
    return { ...(await runAutoRounds(companyId)), results: [] as AutoDispatchResult[] };
  }

  const pending = await prisma.delivery.findMany({
    where: {
      companyId,
      status: "PENDING",
      driverId: null,
    },
    select: {
      id: true,
      postalCode: true,
      pickupPostalCode: true,
      deliveryCategory: true,
      driverId: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
    take: AUTO_DISPATCH_QUEUE_TAKE,
  });

  const sorted = [...pending].sort((a, b) => {
    if (settings.prioritizeCourier) {
      if (a.deliveryCategory === "COURIER" && b.deliveryCategory !== "COURIER") return -1;
      if (b.deliveryCategory === "COURIER" && a.deliveryCategory !== "COURIER") return 1;
    }
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  const results: AutoDispatchResult[] = [];
  let assigned = 0;
  let skipped = 0;

  const pass: AutoDispatchPass = {};
  for (const delivery of sorted) {
    const result = await tryAutoAssignDelivery(companyId, delivery.id, pass);
    results.push(result);
    if (result.assigned) assigned += 1;
    else skipped += 1;
  }

  return { assigned, skipped, results };
}

export type AutoDispatchProposal = {
  deliveryId: string;
  reference: string;
  driverId: string;
  driverName: string;
  reason: string;
};

export type AutoDispatchPreview =
  | { mode: "SUGGESTION"; message: string }
  | { mode: "ROUNDS"; pending: number }
  | { mode: "PROPOSALS"; proposals: AutoDispatchProposal[]; unassigned: Array<{ deliveryId: string; reference: string; reason: string }> };

/**
 * Ce que lancerait « Lancer auto-dispatch », sans rien affecter : le dispatcher valide ensuite.
 * Règles et plafonds sont revérifiés sous verrou à la validation.
 */
export async function previewAutoDispatch(companyId: string): Promise<AutoDispatchPreview> {
  const settings = await getCompanyDispatchSettings(companyId);
  if (!settings.enabled) {
    return { mode: "SUGGESTION", message: "Mode suggestion : validez les propositions livraison par livraison." };
  }
  if (settings.rounds.autoAssign) {
    const pending = await prisma.delivery.count({ where: { companyId, status: "PENDING", driverId: null } });
    return { mode: "ROUNDS", pending };
  }
  const pending = await prisma.delivery.findMany({
    where: { companyId, status: "PENDING", driverId: null },
    select: { id: true, reference: true, deliveryCategory: true, createdAt: true },
    orderBy: { createdAt: "asc" },
    take: AUTO_DISPATCH_QUEUE_TAKE,
  });
  const sorted = [...pending].sort((a, b) => {
    if (settings.prioritizeCourier) {
      if (a.deliveryCategory === "COURIER" && b.deliveryCategory !== "COURIER") return -1;
      if (b.deliveryCategory === "COURIER" && a.deliveryCategory !== "COURIER") return 1;
    }
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  const pass: AutoDispatchPass = { plannedLoad: new Map() };
  const proposals: AutoDispatchProposal[] = [];
  const unassigned: Array<{ deliveryId: string; reference: string; reason: string }> = [];
  for (const delivery of sorted) {
    const found = await pickAutoDriver(companyId, delivery.id, settings, pass);
    if ("skippedReason" in found) {
      unassigned.push({ deliveryId: delivery.id, reference: delivery.reference, reason: found.skippedReason });
      continue;
    }
    const { pick } = found;
    const planned = pass.plannedLoad!.get(pick.driverId) ?? { assigned: 0, byCategory: {} };
    planned.assigned += 1;
    planned.byCategory[pick.category] = (planned.byCategory[pick.category] ?? 0) + 1;
    pass.plannedLoad!.set(pick.driverId, planned);
    proposals.push({ deliveryId: delivery.id, reference: delivery.reference, driverId: pick.driverId, driverName: pick.driverName, reason: pick.reason });
  }
  return { mode: "PROPOSALS", proposals, unassigned };
}

const STALE_PROPOSAL_ERRORS = ["DELIVERY_ALREADY_ASSIGNED", "DELIVERY_NOT_AVAILABLE", "DELIVERY_ASSIGNMENT_CONFLICT", "DELIVERY_STATUS_CONFLICT", "DELIVERY_MISSION_STARTED", "DELIVERY_NOT_ASSIGNABLE", "DELIVERY_CANCELLED", "DRIVER_NOT_FOUND"];

/** Applique les propositions validées ; celle qu'un changement a rendue caduque est écartée, sans forcer. */
export async function confirmAutoDispatch(companyId: string, assignments: Array<{ deliveryId: string; driverId: string; reason?: string }>) {
  let assigned = 0;
  let skipped = 0;
  for (const assignment of assignments) {
    try {
      const updated = await assignDeliveryToDriver(companyId, assignment.deliveryId, assignment.driverId, {
        automatic: true,
        reason: "Proposition validée par le dispatcher",
        expectUnassigned: true,
      });
      if (updated) assigned += 1;
      else skipped += 1;
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      if (STALE_PROPOSAL_ERRORS.includes(code) || code.startsWith("DRIVER_INELIGIBLE:") || code.startsWith("DRIVER_OVER_CAPACITY:")) {
        skipped += 1;
        continue;
      }
      throw error;
    }
  }
  return { assigned, skipped };
}

export async function getEligibleDriversForDelivery(
  companyId: string,
  deliveryId: string
) {
  const delivery = await prisma.delivery.findFirst({
    where: { id: deliveryId, companyId },
    select: {
      id: true,
      postalCode: true,
      pickupPostalCode: true,
      pickupLatitude: true,
      pickupLongitude: true,
      deliveryCategory: true,
      driverId: true,
      status: true,
      createdAt: true,
    },
  });
  if (!delivery) return null;

  const [settings, positioned, tariffSettings] = await Promise.all([
    getCompanyDispatchSettings(companyId),
    getCompanyDriversWithActivity(companyId, { withDispatchPosition: true }),
    getCompanyTariffSettings(companyId),
  ]);
  // L'option GPS s'applique ici (statut DISABLED) ; état de service et position ne sortent pas.
  const proximities = proximitiesFromDrivers(delivery, positioned, settings);
  const drivers = positioned.map((row): DriverActivity => {
    const driver: Partial<typeof row> = { ...row };
    delete driver.settings;
    delete driver.driverLocation;
    return driver as DriverActivity;
  });

  return drivers.map((driver) => {
    const reasons = getDriverEligibilityReasons(
      driver,
      delivery,
      settings,
      tariffSettings.tariffZones
    );
    const rule = getDispatchDriverRule(settings, driver.id);
    return {
      driver,
      eligible: reasons.length === 0,
      reasons,
      rule,
      proximity: proximities.get(driver.id)!,
    };
  });
}

export type DispatchSuggestion = {
  driverId: string;
  firstName: string;
  lastName: string;
  rank: number;
  score: number;
  explanation: string;
  load: number;
  maxLoad: number;
  /** Minutes jusqu'au retrait ; `null` si trajet inconnu. Jamais de coordonnée. */
  travelMinutes: number | null;
  travelSource: "ROUTE" | "STRAIGHT_LINE" | null;
};

export type DispatchSuggestions = {
  deliveryId: string;
  /** Faux si la livraison n'attend plus de livreur : rien n'est proposé. */
  assignable: boolean;
  mode: "SUGGESTION" | "AUTOMATIC";
  /** Compte en lecture seule : suggestions visibles, affectation refusée (renseigné par la route). */
  readOnly?: boolean;
  eligibleCount: number;
  suggestions: DispatchSuggestion[];
};

/**
 * DISPATCH-4 — les 3 meilleurs livreurs d'une livraison en attente, pour le dispatcher.
 * Lecture seule ; l'appel au service de trajet éventuel est hors de toute transaction.
 */
export async function getDispatchSuggestions(
  companyId: string,
  deliveryId: string,
  count = 3,
  /** Imprévu : propose un remplaçant tant que la mission de ce livreur n'a pas démarré. */
  replacesDriverId?: string
): Promise<DispatchSuggestions | null> {
  const [delivery, settings] = await Promise.all([
    prisma.delivery.findFirst({
      where: { id: deliveryId, companyId },
      select: {
        id: true,
        postalCode: true,
        pickupPostalCode: true,
        pickupLatitude: true,
        pickupLongitude: true,
        deliveryCategory: true,
        driverId: true,
        status: true,
        createdAt: true,
        missionStartedAt: true,
      },
    }),
    getCompanyDispatchSettings(companyId),
  ]);
  if (!delivery) return null;
  const mode = settings.enabled ? "AUTOMATIC" : "SUGGESTION";
  const replaceable = Boolean(replacesDriverId)
    && delivery.status === "ASSIGNED"
    && delivery.driverId === replacesDriverId
    && !delivery.missionStartedAt;
  const assignable = replaceable || (delivery.status === "PENDING" && !delivery.driverId);
  if (!assignable) {
    return { deliveryId, assignable, mode, eligibleCount: 0, suggestions: [] };
  }

  const [drivers, tariffSettings] = await Promise.all([
    settings.gpsProximityEnabled
      ? getCompanyDriversWithActivity(companyId, { withDispatchPosition: true })
      : getCompanyDriversWithActivity(companyId),
    getCompanyTariffSettings(companyId),
  ]);
  const positioned = drivers as DriverWithDispatchPosition[];
  const zones = tariffSettings.tariffZones;
  const eligible = filterEligibleDrivers(positioned, delivery, settings, zones)
    .filter((driver) => driver.id !== delivery.driverId);
  const proximities = proximitiesFromDrivers(delivery, eligible as DriverWithDispatchPosition[], settings);
  const travel = await computeTravelTimes(
    delivery,
    new Set(eligible.map((driver) => driver.id)),
    positioned,
    proximities
  );
  const ranked = rankDispatchCandidates(
    buildScoreCandidates(eligible, delivery, settings, zones, proximities, travel)
  );
  const byId = new Map(positioned.map((driver) => [driver.id, driver]));

  return {
    deliveryId,
    assignable,
    mode,
    eligibleCount: eligible.length,
    suggestions: ranked.slice(0, count).map((candidate) => {
      const driver = byId.get(candidate.id)!;
      return {
        driverId: candidate.id,
        firstName: driver.firstName,
        lastName: driver.lastName,
        rank: candidate.rank,
        score: candidate.score,
        explanation: candidate.explanation,
        load: candidate.load,
        maxLoad: candidate.maxLoad,
        travelMinutes: candidate.travel ? Math.max(1, Math.round(candidate.travel.seconds / 60)) : null,
        travelSource: candidate.travel?.source ?? null,
      };
    }),
  };
}

/**
 * Affectation en un clic depuis une suggestion : seulement si la livraison attend encore un
 * livreur (jamais de remplacement silencieux d'une affectation faite entre-temps). Le même
 * livreur déjà affecté est un succès idempotent (double clic). Règles dures et plafonds
 * revérifiés sous verrou par `assignDeliveryToDriver` ; aucun appel réseau dans la transaction.
 */
export async function assignFromSuggestion(companyId: string, deliveryId: string, driverId: string, replacesDriverId?: string) {
  return assignDeliveryToDriver(companyId, deliveryId, driverId, {
    reason: SUGGESTION_HISTORY_REASON,
    ...(replacesDriverId ? { expectedDriverId: replacesDriverId } : { expectUnassigned: true }),
  });
}
