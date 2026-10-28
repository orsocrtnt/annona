import { haversineMeters } from "@/lib/maps/navigation-utils";
import type { CompanyDispatchSettings } from "@/lib/validations/dispatch-settings";

/**
 * Proximité d'un livreur au point de retrait, calculée localement (haversine),
 * sans service de trajet. Seul `NEAR` donne un avantage ; les autres statuts
 * sont neutres : le livreur reste éligible et départagé par les critères habituels.
 */
export type DispatchProximityStatus =
  | "NEAR"
  | "FAR"
  | "STALE"
  | "NO_POSITION"
  | "OFF_DUTY"
  | "NO_PICKUP"
  | "DISABLED";

export type DispatchProximity = {
  status: DispatchProximityStatus;
  distanceMeters: number | null;
  positionAgeSeconds: number | null;
};

type GeoPoint = { latitude: number; longitude: number };

export type DispatchProximitySettings = Pick<
  CompanyDispatchSettings,
  "gpsProximityEnabled" | "gpsPositionMaxAgeMinutes" | "gpsMaxDistanceKm"
>;

const isFiniteCoordinate = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value);

export function getDispatchPickupPoint(delivery: {
  pickupLatitude?: number | null;
  pickupLongitude?: number | null;
}): GeoPoint | null {
  if (!isFiniteCoordinate(delivery.pickupLatitude) || !isFiniteCoordinate(delivery.pickupLongitude)) {
    return null;
  }
  return { latitude: delivery.pickupLatitude, longitude: delivery.pickupLongitude };
}

export function computeDispatchProximity(input: {
  settings: DispatchProximitySettings;
  pickup: GeoPoint | null;
  onDuty: boolean;
  position: (GeoPoint & { updatedAt: Date }) | null;
  now: Date;
}): DispatchProximity {
  const neutral = (status: DispatchProximityStatus, positionAgeSeconds: number | null = null) => ({
    status,
    distanceMeters: null,
    positionAgeSeconds,
  });
  if (!input.settings.gpsProximityEnabled) return neutral("DISABLED");
  // Hors service : la position n'est pas utilisée, ni son âge communiqué.
  if (!input.onDuty) return neutral("OFF_DUTY");
  const position = input.position;
  if (!position || !isFiniteCoordinate(position.latitude) || !isFiniteCoordinate(position.longitude)) {
    return neutral("NO_POSITION");
  }
  const ageSeconds = Math.max(
    0,
    Math.round((input.now.getTime() - position.updatedAt.getTime()) / 1000)
  );
  if (ageSeconds > input.settings.gpsPositionMaxAgeMinutes * 60) return neutral("STALE", ageSeconds);
  if (!input.pickup) return neutral("NO_PICKUP", ageSeconds);

  const distanceMeters = Math.round(haversineMeters(position, input.pickup));
  return {
    status: distanceMeters <= input.settings.gpsMaxDistanceKm * 1000 ? "NEAR" : "FAR",
    distanceMeters,
    positionAgeSeconds: ageSeconds,
  };
}

/** Deux classes seulement (proche / neutre) : l'ordre reste transitif. */
export function compareDispatchProximity(
  a: DispatchProximity | undefined,
  b: DispatchProximity | undefined
): number {
  const da = a?.status === "NEAR" ? a.distanceMeters : null;
  const db = b?.status === "NEAR" ? b.distanceMeters : null;
  if (da === null && db === null) return 0;
  if (da === null) return 1;
  if (db === null) return -1;
  return da - db;
}
