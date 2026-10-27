import { fetchOsrmRoute, type RouteWaypoint } from "@/lib/maps/osrm-route";
import type { LatLng } from "@/lib/maps/route-progress";

/** Itinéraires déjà calculés, partagés par toutes les cartes de la page. */
const routeCache = new Map<string, LatLng[]>();
const ROUTE_CACHE_LIMIT = 100;
/** Le service public d'itinéraires limite à une requête par seconde : appels en file. */
const ROUTE_REQUEST_SPACING_MS = 1_150;
let routeQueue: Promise<unknown> = Promise.resolve();

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const pointKey = (point: { latitude: number; longitude: number }) => `${point.latitude.toFixed(5)},${point.longitude.toFixed(5)}`;

/**
 * Itinéraire routier passant par `waypoints`, en file avec tous les autres appels de la page
 * (une requête par seconde) et mis en cache. null si le service ne répond pas.
 */
export function requestQueuedRoute(waypoints: RouteWaypoint[]): Promise<LatLng[] | null> {
  const key = waypoints.map(pointKey).join(">");
  const cached = routeCache.get(key);
  if (cached) return Promise.resolve(cached);
  const run = routeQueue.then(async () => {
    // Une requête trop rapprochée d'un autre appel de la page renvoie null : un seul nouvel essai.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const route = await fetchOsrmRoute(waypoints);
      if (route && route.length >= 2) {
        if (routeCache.size >= ROUTE_CACHE_LIMIT) routeCache.delete(routeCache.keys().next().value!);
        routeCache.set(key, route);
        return route;
      }
      if (attempt === 0) await wait(ROUTE_REQUEST_SPACING_MS);
    }
    return null;
  });
  routeQueue = run.then(() => wait(ROUTE_REQUEST_SPACING_MS), () => wait(ROUTE_REQUEST_SPACING_MS));
  return run;
}
