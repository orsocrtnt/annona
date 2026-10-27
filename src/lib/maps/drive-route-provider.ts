import { ROUTE_BASE_URL, isValidCoordinate } from "@/lib/maps/provider-config";
import { fetchProviderJson } from "@/lib/maps/provider-request";
import type { DriveRoute } from "@/lib/maps/drive-simulation";
import type { LatLng } from "@/lib/maps/route-progress";

type Point = { latitude: number; longitude: number };

/** Itinéraire de secours (IGN, Géoplateforme) quand OSRM ne répond pas : jamais de ligne droite. */
const IGN_ROUTE_URL = process.env.IGN_ROUTE_URL || "https://data.geopf.fr/navigation/itineraire";
/** Un carrefour d'au moins quatre branches est un « grand carrefour » : feu simulé possible. */
const MAJOR_INTERSECTION_BRANCHES = 4;

const lngLat = (point: Point) => `${point.longitude},${point.latitude}`;
const toLatLng = (coordinate: unknown): LatLng | null => {
  if (!Array.isArray(coordinate) || !isValidCoordinate(coordinate[1], coordinate[0])) return null;
  return [coordinate[1] as number, coordinate[0] as number];
};
const toPoints = (coordinates: unknown): LatLng[] | null => {
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
  const points = coordinates.map(toLatLng);
  return points.every((point): point is LatLng => point !== null) ? points : null;
};

/** OSRM : géométrie et grands carrefours du trajet (étapes détaillées). */
export async function fetchOsrmDriveRoute(from: Point, target: Point): Promise<DriveRoute | null> {
  try {
    const json = await fetchProviderJson(
      `${ROUTE_BASE_URL.replace(/\/$/, "")}/route/v1/driving/${lngLat(from)};${lngLat(target)}?overview=full&geometries=geojson&steps=true`
    ) as { code?: string; routes?: { geometry?: { coordinates?: unknown }; legs?: { steps?: { intersections?: { location?: unknown; bearings?: unknown[] }[] }[] }[] }[] };
    const route = json.routes?.[0];
    const points = json.code === "Ok" ? toPoints(route?.geometry?.coordinates) : null;
    if (!points) return null;
    const lights: LatLng[] = [];
    for (const leg of route?.legs ?? []) {
      for (const step of leg.steps ?? []) {
        for (const intersection of step.intersections ?? []) {
          const location = toLatLng(intersection.location);
          if (location && (intersection.bearings?.length ?? 0) >= MAJOR_INTERSECTION_BRANCHES) lights.push(location);
        }
      }
    }
    return { points, lights };
  } catch {
    return null;
  }
}

/** IGN : géométrie seule (pas de carrefours détaillés) ; le livreur ralentit tout de même en virage. */
export async function fetchIgnDriveRoute(from: Point, target: Point): Promise<DriveRoute | null> {
  try {
    const json = await fetchProviderJson(
      `${IGN_ROUTE_URL}?resource=bdtopo-valhalla&start=${lngLat(from)}&end=${lngLat(target)}&profile=car&optimization=fastest&geometryFormat=geojson&getSteps=false`
    ) as { geometry?: { coordinates?: unknown } };
    const points = toPoints(json.geometry?.coordinates);
    return points ? { points, lights: [] } : null;
  } catch {
    return null;
  }
}

export async function fetchDriveRoute(from: Point, target: Point): Promise<DriveRoute | null> {
  return (await fetchOsrmDriveRoute(from, target)) ?? (await fetchIgnDriveRoute(from, target));
}
