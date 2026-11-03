import { serverRouteProviderConfig } from "@/lib/maps/provider-config";
import { fetchProviderJson } from "@/lib/maps/provider-request";
import {
  parseIgnNavigationRoute,
  parseOsrmNavigationRoute,
  validWaypoints,
  type NavigationRoute,
  type RouteWaypoint,
} from "@/lib/maps/navigation-route";

const lngLat = (point: RouteWaypoint) => `${point.longitude},${point.latitude}`;

/** URL du calcul d'itinéraire IGN (ressource `bdtopo-valhalla`, voiture, plus rapide, étapes). */
export function ignRouteUrl(baseUrl: string, waypoints: RouteWaypoint[]): string {
  const params = new URLSearchParams({
    resource: "bdtopo-valhalla",
    start: lngLat(waypoints[0]!),
    end: lngLat(waypoints[waypoints.length - 1]!),
    profile: "car",
    optimization: "fastest",
    geometryFormat: "geojson",
    getSteps: "true",
    distanceUnit: "meter",
    timeUnit: "second",
  });
  const intermediates = waypoints.slice(1, -1).map(lngLat).join("|");
  if (intermediates) params.set("intermediates", intermediates);
  return `${baseUrl}?${params.toString()}`;
}

/**
 * LEGAL-1 : l'itinéraire est calculé par le serveur, jamais par le navigateur, et seulement chez un
 * fournisseur explicitement configuré (`DRIVE_ROUTE_OSRM_URL` privé, sinon `DRIVE_ROUTE_IGN_URL`). La
 * position du livreur ne part donc plus vers un service public sans contrat, et son adresse IP non plus.
 * Aucun fournisseur configuré ou réponse invalide : null (l'écran garde la carte sans tracé).
 */
export async function fetchServerNavigationRoute(
  waypoints: RouteWaypoint[],
  deps: {
    config?: ReturnType<typeof serverRouteProviderConfig>;
    fetchJson?: (url: string) => Promise<unknown>;
  } = {}
): Promise<NavigationRoute | null> {
  if (!validWaypoints(waypoints)) return null;
  const config = deps.config === undefined ? serverRouteProviderConfig() : deps.config;
  if (!config) return null;
  const fetchJson = deps.fetchJson ?? ((url: string) => fetchProviderJson(url));
  if (config.osrmUrl) {
    const coords = waypoints.map(lngLat).join(";");
    const route = await fetchJson(`${config.osrmUrl}/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`)
      .then(parseOsrmNavigationRoute, () => null);
    if (route) return route;
  }
  if (config.ignUrl) {
    return fetchJson(ignRouteUrl(config.ignUrl, waypoints)).then(parseIgnNavigationRoute, () => null);
  }
  return null;
}
