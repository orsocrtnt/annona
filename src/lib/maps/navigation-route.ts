import { isValidCoordinate } from "@/lib/maps/provider-config";
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

/** Itinéraires calculés par le serveur : au plus 12 points (départ, arrêts, arrivée). */
export const MAX_ROUTE_WAYPOINTS = 12;

export function validWaypoints(waypoints: RouteWaypoint[]): boolean {
  return waypoints.length >= 2 && waypoints.length <= MAX_ROUTE_WAYPOINTS &&
    waypoints.every((point) => isValidCoordinate(point.latitude, point.longitude));
}

type OsrmStep = {
  distance: number;
  name?: string;
  maneuver: { type: string; modifier?: string | null; location: [number, number] };
};

function validPolyline(coordinates: unknown): coordinates is [number, number][] {
  return Array.isArray(coordinates) && coordinates.length >= 2 &&
    coordinates.every((point) => Array.isArray(point) && isValidCoordinate(point[1], point[0]));
}

function positive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/** Réponse OSRM (`/route/v1/driving`) ; aucune substitution en ligne droite : invalide = null. */
export function parseOsrmNavigationRoute(json: unknown): NavigationRoute | null {
  const data = json as {
    code?: string;
    routes?: { distance: number; duration: number; geometry?: { coordinates?: unknown }; legs?: { steps: OsrmStep[] }[] }[];
  } | null;
  const route = data?.routes?.[0];
  if (data?.code !== "Ok" || !route || !validPolyline(route.geometry?.coordinates) ||
    !positive(route.distance) || !positive(route.duration)) return null;
  const steps: NavigationRouteStep[] = [];
  for (const leg of route.legs ?? []) {
    for (const step of leg.steps ?? []) {
      const [lng, lat] = step.maneuver?.location ?? [];
      if (!isValidCoordinate(lat, lng) || !Number.isFinite(step.distance) || step.distance < 0) return null;
      steps.push({
        instruction: buildManeuverInstruction(step.maneuver.type, step.maneuver.modifier, step.name),
        distanceMeters: step.distance,
        latitude: lat as number,
        longitude: lng as number,
        maneuverType: step.maneuver.type,
        modifier: step.maneuver.modifier,
        streetName: step.name ?? null,
      });
    }
  }
  if (steps.length === 0) return null;
  return {
    polyline: route.geometry!.coordinates!.map(([lng, lat]) => [lat, lng]),
    distanceMeters: route.distance,
    durationSeconds: route.duration,
    steps,
  };
}

/**
 * Nom de voie IGN seulement s'il est lisible : le 3 novembre 2026, l'attribut `name` de la
 * Géoplateforme arrivait tronqué (fragments de JSON). Mieux vaut « Tournez à droite » qu'un nom faux.
 */
export function readableStreetName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim();
  if (!name || name.length > 80 || /["{}:\\]|^\d+$/.test(name)) return null;
  return /\p{L}{2,}/u.test(name) && /\s/.test(name) ? name : null;
}

type IgnStep = {
  geometry?: { coordinates?: unknown };
  attributes?: { name?: unknown };
  distance?: number;
  instruction?: { type?: string; modifier?: string | null };
};

/** Réponse du calcul d'itinéraire de la Géoplateforme IGN (`/navigation/itineraire`, GeoJSON, mètres, secondes). */
export function parseIgnNavigationRoute(json: unknown): NavigationRoute | null {
  const data = json as {
    geometry?: { coordinates?: unknown };
    distance?: number;
    duration?: number;
    distanceUnit?: string;
    timeUnit?: string;
    portions?: { steps?: IgnStep[] }[];
  } | null;
  if (!data || (data.distanceUnit && data.distanceUnit !== "meter") || (data.timeUnit && data.timeUnit !== "second")) return null;
  const coordinates = data.geometry?.coordinates;
  if (!validPolyline(coordinates) || !positive(data.distance) || !positive(data.duration)) return null;
  const steps: NavigationRouteStep[] = [];
  for (const portion of data.portions ?? []) {
    for (const step of portion.steps ?? []) {
      const first = (step.geometry?.coordinates as unknown[] | undefined)?.[0] as [number, number] | undefined;
      const type = step.instruction?.type;
      if (!first || !isValidCoordinate(first[1], first[0]) || typeof type !== "string" ||
        typeof step.distance !== "number" || !Number.isFinite(step.distance) || step.distance < 0) return null;
      const streetName = readableStreetName(step.attributes?.name);
      const modifier = step.instruction?.modifier ?? null;
      steps.push({
        instruction: buildManeuverInstruction(type, modifier, streetName),
        distanceMeters: step.distance,
        latitude: first[1],
        longitude: first[0],
        maneuverType: type,
        modifier,
        streetName,
      });
    }
  }
  if (steps.length === 0) return null;
  return {
    polyline: coordinates.map(([lng, lat]) => [lat, lng]),
    distanceMeters: data.distance,
    durationSeconds: data.duration,
    steps,
  };
}
