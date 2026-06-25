import { haversineMeters } from "@/lib/maps/navigation-utils";

/** Distance max (m) pour valider collecte / livraison sans confirmation. */
export const DRIVER_PROXIMITY_THRESHOLD_METERS = 150;

export type ProximityTargetKind = "pickup" | "delivery";

export type GeoPoint = {
  latitude: number;
  longitude: number;
};

export function isNearLocation(
  driver: GeoPoint,
  target: GeoPoint,
  thresholdMeters = DRIVER_PROXIMITY_THRESHOLD_METERS
): boolean {
  return haversineMeters(driver, target) <= thresholdMeters;
}

function readPosition(position: GeolocationPosition): GeoPoint & { accuracy?: number } {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
  };
}

function requestPosition(options: PositionOptions): Promise<(GeoPoint & { accuracy?: number }) | null> {
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(readPosition(position)),
      () => resolve(null),
      options
    );
  });
}

export async function getCurrentDriverPosition(): Promise<(GeoPoint & { accuracy?: number }) | null> {
  if (typeof window === "undefined" || !navigator.geolocation) {
    return null;
  }

  const highAccuracy = await requestPosition({
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 10_000,
  });
  if (highAccuracy) return highAccuracy;

  const cached = await requestPosition({
    enableHighAccuracy: false,
    maximumAge: 120_000,
    timeout: 8_000,
  });
  if (cached) return cached;

  return requestPosition({
    enableHighAccuracy: false,
    maximumAge: 300_000,
    timeout: 5_000,
  });
}
