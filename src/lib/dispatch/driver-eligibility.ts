import type { DeliveryCategory } from "@prisma/client";
import { matchesPostalCodePrefix } from "@/lib/dispatch/postal-codes";
import { findTariffZoneForPostalCode } from "@/lib/tariff/find-tariff-zone";
import type { TariffZone } from "@/lib/validations/tariff-settings";
import type {
  CompanyDispatchSettings,
  DispatchDriverRule,
} from "@/lib/validations/dispatch-settings";
import {
  DEFAULT_DISPATCH_DRIVER_CATEGORIES,
  getDispatchDriverRule,
  normalizeDispatchDriverRule,
} from "@/lib/validations/dispatch-settings";

export type DeliveryForEligibility = {
  deliveryCategory: DeliveryCategory;
  postalCode: string | null;
  pickupPostalCode?: string | null;
};

export type DriverActivityForEligibility = {
  id: string;
  assigned?: number;
  inTransit?: number;
  activeByCategory?: Partial<Record<DeliveryCategory, number>>;
};

export type DriverEligibilityReason =
  | "DISPATCH_PAUSED"
  | "CATEGORY_NOT_ALLOWED"
  | "ZONE_NOT_COVERED"
  | "MAX_LOAD_REACHED"
  | "MAX_CATEGORY_LOAD_REACHED";

export const DRIVER_ELIGIBILITY_LABELS: Record<DriverEligibilityReason, string> = {
  DISPATCH_PAUSED: "En pause dispatch",
  CATEGORY_NOT_ALLOWED: "Catégorie non autorisée",
  ZONE_NOT_COVERED: "Hors zone couverte",
  MAX_LOAD_REACHED: "Charge max atteinte",
  MAX_CATEGORY_LOAD_REACHED: "Charge max catégorie atteinte",
};

export const SOFT_DRIVER_ELIGIBILITY_REASONS: DriverEligibilityReason[] = [
  "MAX_LOAD_REACHED",
  "MAX_CATEGORY_LOAD_REACHED",
];

export function splitEligibilityReasons(reasons: DriverEligibilityReason[]) {
  const soft = reasons.filter((reason) => SOFT_DRIVER_ELIGIBILITY_REASONS.includes(reason));
  const hard = reasons.filter((reason) => !SOFT_DRIVER_ELIGIBILITY_REASONS.includes(reason));
  return { soft, hard };
}

export function isOnlySoftIneligibility(reasons: DriverEligibilityReason[]) {
  return reasons.length > 0 && splitEligibilityReasons(reasons).hard.length === 0;
}

export function isSoftIneligibilityMessage(message: string) {
  return (
    message.includes("Charge max") ||
    message.includes(DRIVER_ELIGIBILITY_LABELS.MAX_LOAD_REACHED) ||
    message.includes(DRIVER_ELIGIBILITY_LABELS.MAX_CATEGORY_LOAD_REACHED)
  );
}

export function getDispatchPostalCode(delivery: DeliveryForEligibility): string | null {
  if (delivery.deliveryCategory === "COURIER") {
    return delivery.pickupPostalCode ?? delivery.postalCode;
  }
  return delivery.postalCode;
}

export function activeLoad(driver: DriverActivityForEligibility): number {
  return (driver.assigned ?? 0) + (driver.inTransit ?? 0);
}

export function activeLoadForCategory(
  driver: DriverActivityForEligibility,
  category: DeliveryCategory
): number {
  return driver.activeByCategory?.[category] ?? 0;
}

export function maxForDriver(
  driverId: string,
  settings: CompanyDispatchSettings
): number {
  const rule = getDispatchDriverRule(settings, driverId);
  return rule?.maxActiveDeliveries ?? settings.maxActiveDeliveriesPerDriver;
}

export function maxForDriverCategory(
  driverId: string,
  category: DeliveryCategory,
  settings: CompanyDispatchSettings
): number | null {
  const rule = getDispatchDriverRule(settings, driverId);
  const cap = rule?.maxActiveByCategory?.[category];
  return cap ?? null;
}

export function isCategoryAllowed(
  rule: DispatchDriverRule | null,
  category: DeliveryCategory
): boolean {
  const allowed = rule?.allowedCategories ?? DEFAULT_DISPATCH_DRIVER_CATEGORIES;
  if (category === "COURIER") return allowed.COURIER;
  if (category === "SPECIAL_MISSION") return allowed.SPECIAL_MISSION;
  return allowed.STANDARD;
}

export function isZoneAllowed(
  rule: DispatchDriverRule | null,
  postalCode: string | null,
  tariffZones: TariffZone[]
): boolean {
  const zoneIds = rule?.zoneIds ?? [];
  const postalPrefixes = rule?.postalCodePrefixes ?? [];

  if (zoneIds.length === 0 && postalPrefixes.length === 0) return true;
  if (!postalCode) return false;

  if (postalPrefixes.length > 0 && matchesPostalCodePrefix(postalCode, postalPrefixes)) {
    return true;
  }

  if (zoneIds.length > 0) {
    const zone = findTariffZoneForPostalCode(postalCode, tariffZones);
    if (zone && zoneIds.includes(zone.id)) return true;
  }

  return false;
}

export function getDriverEligibilityReasons(
  driver: DriverActivityForEligibility,
  delivery: DeliveryForEligibility,
  settings: CompanyDispatchSettings,
  tariffZones: TariffZone[]
): DriverEligibilityReason[] {
  const rule = getDispatchDriverRule(settings, driver.id);
  const normalized = rule ? normalizeDispatchDriverRule(rule) : null;
  const reasons: DriverEligibilityReason[] = [];

  if (normalized?.dispatchStatus === "PAUSED") {
    reasons.push("DISPATCH_PAUSED");
  }

  if (!isCategoryAllowed(normalized, delivery.deliveryCategory)) {
    reasons.push("CATEGORY_NOT_ALLOWED");
  }

  const postalCode = getDispatchPostalCode(delivery);
  if (!isZoneAllowed(normalized, postalCode, tariffZones)) {
    reasons.push("ZONE_NOT_COVERED");
  }

  if (activeLoad(driver) >= maxForDriver(driver.id, settings)) {
    reasons.push("MAX_LOAD_REACHED");
  }

  const categoryCap = maxForDriverCategory(
    driver.id,
    delivery.deliveryCategory,
    settings
  );
  if (
    categoryCap !== null &&
    activeLoadForCategory(driver, delivery.deliveryCategory) >= categoryCap
  ) {
    reasons.push("MAX_CATEGORY_LOAD_REACHED");
  }

  return reasons;
}

export function isDriverEligibleForDelivery(
  driver: DriverActivityForEligibility,
  delivery: DeliveryForEligibility,
  settings: CompanyDispatchSettings,
  tariffZones: TariffZone[]
): boolean {
  return getDriverEligibilityReasons(driver, delivery, settings, tariffZones).length === 0;
}

export function formatEligibilityReasons(reasons: DriverEligibilityReason[]): string {
  return reasons.map((reason) => DRIVER_ELIGIBILITY_LABELS[reason]).join(", ");
}
