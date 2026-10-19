import { ROUTE_BASE_URL, isValidCoordinate } from "@/lib/maps/provider-config";
import { fetchProviderJson } from "@/lib/maps/provider-request";
import { buildManeuverInstruction } from "@/lib/maps/navigation-utils";

export type RouteWaypoint = {
  latitude: number;
  longitude: number;
  label?: string;
};

export type NavigationRouteStep = {
  instruction: string;
  distanceMeters: number;
  latitude: number;
  longitude: number;
  maneuverType: string;
  modifier?: string | null;
  streetName?: string | null;
};

export type NavigationRoute = {
  polyline: [number, number][];
  distanceMeters: number;
  durationSeconds: number;
  steps: NavigationRouteStep[];
};

type OsrmStep = {
  distance: number;
  name?: string;
  maneuver: {
    type: string;
    modifier?: string | null;
    location: [number, number];
  };
};

let lastRequestAt = 0;

/** No straight-line substitute: an unavailable route is null. */
export async function fetchOsrmRoute(waypoints: RouteWaypoint[], signal?: AbortSignal): Promise<[number, number][] | null> {
  return (await fetchOsrmNavigationRoute(waypoints, signal))?.polyline ?? null;
}

export async function fetchOsrmNavigationRoute(waypoints: RouteWaypoint[], signal?: AbortSignal): Promise<NavigationRoute | null> {
  if (waypoints.length < 2 || waypoints.some(w => !isValidCoordinate(w.latitude, w.longitude))) return null;
  if (Date.now() - lastRequestAt < 1_100) return null;
  lastRequestAt = Date.now();
  try {
    const coords = waypoints.map(w => `${w.longitude},${w.latitude}`).join(";");
    const json = await fetchProviderJson(`${ROUTE_BASE_URL.replace(/\/$/, "")}/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`, signal) as {
      code?: string;
      routes?: { distance: number; duration: number; geometry?: { coordinates?: [number, number][] }; legs?: { steps: OsrmStep[] }[] }[];
    };
    const route = json.routes?.[0];
    if (json.code !== "Ok" || !route?.geometry?.coordinates || route.geometry.coordinates.length < 2 ||
      !Number.isFinite(route.distance) || route.distance <= 0 || !Number.isFinite(route.duration) || route.duration <= 0 ||
      route.geometry.coordinates.some(p => !Array.isArray(p) || !isValidCoordinate(p[1], p[0]))) return null;
    const steps: NavigationRouteStep[] = [];
    for (const leg of route.legs ?? []) {
      for (const step of leg.steps ?? []) {
        const [lng, lat] = step.maneuver.location;
        if (!isValidCoordinate(lat, lng) || !Number.isFinite(step.distance) || step.distance < 0) return null;
        steps.push({ instruction: buildManeuverInstruction(step.maneuver.type, step.maneuver.modifier, step.name), distanceMeters: step.distance,
          latitude: lat, longitude: lng, maneuverType: step.maneuver.type, modifier: step.maneuver.modifier, streetName: step.name ?? null });
      }
    }
    if (steps.length === 0) return null;
    return { polyline: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]), distanceMeters: route.distance, durationSeconds: route.duration, steps };
  } catch { return null; }
}
