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

export type DriverPosition = GeoPoint & { accuracy?: number };
export const POSITION_WAIT_MS = 6_000;
const POSITION_MAX_AGE_MS = 15_000;
let recentPosition: { point: DriverPosition; timestamp: number } | null = null;
let positionRequest: Promise<DriverPosition | null> | null = null;

/** Share the active watch's fresh signal with mission actions, without starting another watch. */
export function rememberDriverPosition(position: { coords: { latitude: number; longitude: number; accuracy: number }; timestamp: number }) {
  const point = {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
  };
  recentPosition = { point, timestamp: position.timestamp || Date.now() };
  return point;
}

export function clearRememberedDriverPosition() {
  recentPosition = null;
}

export function getCurrentDriverPosition(): Promise<DriverPosition | null> {
  if (recentPosition && Date.now() - recentPosition.timestamp <= POSITION_MAX_AGE_MS) {
    return Promise.resolve(recentPosition.point);
  }
  if (positionRequest) return positionRequest;
  if (typeof window === "undefined" || !navigator.geolocation) return Promise.resolve(null);

  positionRequest = new Promise<DriverPosition | null>((resolve) => {
    let settled = false;
    const finish = (point: DriverPosition | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(point);
    };
    // Some browsers ignore the geolocation timeout while the permission prompt is open.
    const timer = setTimeout(() => finish(null), POSITION_WAIT_MS);
    try {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (!settled) finish(rememberDriverPosition(position));
        },
        () => finish(null),
        { enableHighAccuracy: true, maximumAge: POSITION_MAX_AGE_MS, timeout: POSITION_WAIT_MS }
      );
    } catch {
      finish(null);
    }
  }).finally(() => { positionRequest = null; });
  return positionRequest;
}
