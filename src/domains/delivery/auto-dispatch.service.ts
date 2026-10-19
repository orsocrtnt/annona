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
  type DeliveryForEligibility,
} from "@/lib/dispatch/driver-eligibility";
import type {
  CompanyDispatchSettings,
  DispatchDriverRule,
} from "@/lib/validations/dispatch-settings";
import { AUTO_DISPATCH_QUEUE_TAKE } from "@/lib/query/list-limits";
import { getDispatchDriverRule } from "@/lib/validations/dispatch-settings";

type DriverActivity = Awaited<ReturnType<typeof getCompanyDriversWithActivity>>[number];

type DeliveryForDispatch = DeliveryForEligibility & {
  id: string;
  driverId: string | null;
  status: string;
  createdAt: Date;
};

export type AutoDispatchResult = {
  deliveryId: string;
  assigned: boolean;
  driverId?: string;
  reason?: string;
  skippedReason?: string;
};

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
  category: DeliveryCategory
): { driverId: string; reason: string } | null {
  if (drivers.length === 0) return null;

  const rules = [...settings.driverRules].sort((a, b) => a.priority - b.priority);

  if (rules.length > 0) {
    for (const rule of rules) {
      const driver = drivers.find((d) => d.id === rule.driverId);
      if (driver) {
        return {
          driverId: driver.id,
          reason: `Priorité ${rule.priority} (${strategyLabel("PRIORITY_LIST")})`,
        };
      }
    }
    return null;
  }

  const sorted = [...drivers].sort((a, b) => {
    if (settings.prioritizeCourier && category === "COURIER") {
      const pa = priorityForDriver(a.id, settings.driverRules) ?? 999;
      const pb = priorityForDriver(b.id, settings.driverRules) ?? 999;
      if (pa !== pb) return pa - pb;
    }
    return activeLoad(a) - activeLoad(b);
  });

  const picked = sorted[0]!;
  return {
    driverId: picked.id,
    reason: `Chauffeur le moins chargé (${activeLoad(picked)} active(s))`,
  };
}

function pickByLeastLoaded(
  drivers: DriverActivity[],
  settings: CompanyDispatchSettings,
  category: DeliveryCategory
): { driverId: string; reason: string } | null {
  if (drivers.length === 0) return null;

  const sorted = [...drivers].sort((a, b) => {
    const loadDiff = activeLoad(a) - activeLoad(b);
    if (loadDiff !== 0) return loadDiff;

    if (settings.prioritizeCourier && category === "COURIER") {
      const pa = priorityForDriver(a.id, settings.driverRules) ?? 999;
      const pb = priorityForDriver(b.id, settings.driverRules) ?? 999;
      return pa - pb;
    }

    const pa = priorityForDriver(a.id, settings.driverRules) ?? 999;
    const pb = priorityForDriver(b.id, settings.driverRules) ?? 999;
    return pa - pb;
  });

  const picked = sorted[0]!;
  return {
    driverId: picked.id,
    reason: `Moins chargé : ${activeLoad(picked)} livraison(s) active(s)`,
  };
}

function pickByZoneThenPriority(
  drivers: DriverActivity[],
  settings: CompanyDispatchSettings,
  delivery: DeliveryForDispatch,
  tariffZones: Awaited<ReturnType<typeof getCompanyTariffSettings>>["tariffZones"]
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

  const fallback = pickByPriorityList(drivers, settings, delivery.deliveryCategory);
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

export function resolveDriverForDelivery(
  delivery: DeliveryForDispatch,
  settings: CompanyDispatchSettings,
  drivers: DriverActivity[],
  tariffZones: Awaited<ReturnType<typeof getCompanyTariffSettings>>["tariffZones"]
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

  switch (settings.strategy) {
    case "LEAST_LOADED":
      pick = pickByLeastLoaded(eligible, settings, delivery.deliveryCategory);
      break;
    case "ZONE_THEN_PRIORITY":
      pick = pickByZoneThenPriority(eligible, settings, delivery, tariffZones);
      break;
    case "PRIORITY_LIST":
    default:
      pick = pickByPriorityList(eligible, settings, delivery.deliveryCategory);
      break;
  }

  if (pick) return pick;

  if (settings.defaultDriverId) {
    const defaultDriver = eligible.find((d) => d.id === settings.defaultDriverId);
    if (defaultDriver) {
      return {
        driverId: defaultDriver.id,
        reason: "Chauffeur par défaut",
      };
    }
  }

  return null;
}

export async function tryAutoAssignDelivery(
  companyId: string,
  deliveryId: string
): Promise<AutoDispatchResult> {
  const settings = await getCompanyDispatchSettings(companyId);
  if (!settings.enabled) {
    return {
      deliveryId,
      assigned: false,
      skippedReason: "Auto-dispatch désactivé",
    };
  }

  const delivery = await prisma.delivery.findFirst({
    where: { id: deliveryId, companyId },
    select: {
      id: true,
      postalCode: true,
      pickupPostalCode: true,
      deliveryCategory: true,
      driverId: true,
      status: true,
      createdAt: true,
    },
  });

  if (!delivery) {
    return { deliveryId, assigned: false, skippedReason: "Livraison introuvable" };
  }

  if (delivery.driverId) {
    return { deliveryId, assigned: false, skippedReason: "Déjà assignée" };
  }

  if (delivery.status !== "PENDING") {
    return { deliveryId, assigned: false, skippedReason: "Statut non éligible" };
  }

  const [drivers, tariffSettings] = await Promise.all([
    getCompanyDriversWithActivity(companyId),
    getCompanyTariffSettings(companyId),
  ]);

  if (drivers.length === 0) {
    return { deliveryId, assigned: false, skippedReason: "Aucun chauffeur actif" };
  }

  const pick = resolveDriverForDelivery(
    delivery,
    settings,
    drivers,
    tariffSettings.tariffZones
  );

  if (!pick) {
    return {
      deliveryId,
      assigned: false,
      skippedReason: "Aucun chauffeur compatible selon les règles",
    };
  }

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
      message: "Auto-dispatch désactivé",
    };
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

  for (const delivery of sorted) {
    const result = await tryAutoAssignDelivery(companyId, delivery.id);
    results.push(result);
    if (result.assigned) assigned += 1;
    else skipped += 1;
  }

  return { assigned, skipped, results };
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
      deliveryCategory: true,
      driverId: true,
      status: true,
      createdAt: true,
    },
  });
  if (!delivery) return null;

  const [settings, drivers, tariffSettings] = await Promise.all([
    getCompanyDispatchSettings(companyId),
    getCompanyDriversWithActivity(companyId),
    getCompanyTariffSettings(companyId),
  ]);

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
    };
  });
}
