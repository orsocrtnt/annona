import { prisma } from "@/services/prisma/client";
import type { DeliveryCategory } from "@prisma/client";
import { getDriverMissionNavigation } from "@/domains/delivery/driver-navigation.service";
import {
  DRIVER_PROXIMITY_THRESHOLD_METERS,
  isNearLocation,
  type ProximityTargetKind,
} from "@/lib/maps/driver-proximity";
import { haversineMeters } from "@/lib/maps/navigation-utils";

export type MissionProximityResult = {
  kind: ProximityTargetKind;
  hasLocation: boolean;
  near: boolean;
  distanceMeters: number | null;
  thresholdMeters: number;
};

export class DriverProximityError extends Error {
  readonly code = "DRIVER_NOT_AT_LOCATION";

  constructor(
    public readonly kind: ProximityTargetKind,
    public readonly distanceMeters: number | null
  ) {
    super("Le livreur n'est pas proche du point attendu");
    this.name = "DriverProximityError";
  }
}

export function statusNeedsProximityCheck(
  status: "PURCHASING" | "IN_DELIVERY" | "DELIVERED" | "FAILED",
  deliveryCategory: DeliveryCategory
): { required: true; kind: ProximityTargetKind } | { required: false } {
  if (status === "DELIVERED" || status === "FAILED") {
    return { required: true, kind: "delivery" };
  }
  if (status === "PURCHASING" && deliveryCategory === "COURIER") {
    return { required: true, kind: "pickup" };
  }
  return { required: false };
}

export async function checkDriverMissionProximity(
  driverId: string,
  companyId: string,
  deliveryId: string,
  kind: ProximityTargetKind,
  overridePosition?: { latitude: number; longitude: number } | null
): Promise<MissionProximityResult | null> {
  const navigation = await getDriverMissionNavigation(driverId, companyId, deliveryId);
  if (!navigation) return null;

  const target =
    kind === "delivery"
      ? navigation.destination
      : navigation.pickup ?? navigation.pickups[0] ?? null;

  if (!target) {
    return {
      kind,
      hasLocation: false,
      near: false,
      distanceMeters: null,
      thresholdMeters: DRIVER_PROXIMITY_THRESHOLD_METERS,
    };
  }

  let latitude = overridePosition?.latitude ?? null;
  let longitude = overridePosition?.longitude ?? null;

  if (latitude == null || longitude == null) {
    const driverLoc = await prisma.driverLocation.findUnique({
      where: { driverId },
      select: { latitude: true, longitude: true },
    });
    latitude = driverLoc?.latitude ?? null;
    longitude = driverLoc?.longitude ?? null;
  }

  if (latitude == null || longitude == null) {
    return {
      kind,
      hasLocation: false,
      near: false,
      distanceMeters: null,
      thresholdMeters: DRIVER_PROXIMITY_THRESHOLD_METERS,
    };
  }

  const driverPoint = { latitude, longitude };
  const targetPoint = { latitude: target.latitude, longitude: target.longitude };
  const distanceMeters = haversineMeters(driverPoint, targetPoint);

  return {
    kind,
    hasLocation: true,
    near: isNearLocation(driverPoint, targetPoint),
    distanceMeters,
    thresholdMeters: DRIVER_PROXIMITY_THRESHOLD_METERS,
  };
}

/**
 * Refuse une étape hors zone, sauf confirmation explicite du livreur. Confirmée hors zone, l'étape passe et
 * le contrôle est renvoyé (distance comprise) pour être signalé à l'équipe (MOB-01C) ; sinon `null`.
 */
export async function assertDriverMissionProximityOrThrow(
  driverId: string,
  companyId: string,
  deliveryId: string,
  kind: ProximityTargetKind,
  confirmOutOfRange: boolean | undefined,
  overridePosition?: { latitude: number; longitude: number } | null
): Promise<MissionProximityResult | null> {
  const check = await checkDriverMissionProximity(
    driverId,
    companyId,
    deliveryId,
    kind,
    overridePosition
  );

  if (!check || (check.hasLocation && check.near)) return null;
  if (confirmOutOfRange) return check;
  throw new DriverProximityError(kind, check.distanceMeters);
}
