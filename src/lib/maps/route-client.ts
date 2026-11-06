import { PROVIDER_TIMEOUT_MS } from "@/lib/maps/provider-config";
import { validWaypoints, type NavigationRoute, type RouteWaypoint } from "@/lib/maps/navigation-route";

export type { NavigationRoute, NavigationRouteStep, RouteWaypoint } from "@/lib/maps/navigation-route";

let lastRequestAt = 0;

/**
 * Itinéraire demandé au serveur Annona (`/api/maps/route`), qui seul parle au fournisseur (LEGAL-1).
 * Aucune substitution en ligne droite : indisponible = null. Un appel par seconde au plus par page.
 */
export async function fetchNavigationRoute(waypoints: RouteWaypoint[], signal?: AbortSignal): Promise<NavigationRoute | null> {
  if (!validWaypoints(waypoints)) return null;
  if (Date.now() - lastRequestAt < 1_100) return null;
  lastRequestAt = Date.now();
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, PROVIDER_TIMEOUT_MS + 2_000);
  try {
    const response = await fetch("/api/maps/route", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ waypoints: waypoints.map(({ latitude, longitude }) => ({ latitude, longitude })) }),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const json = await response.json() as { data?: NavigationRoute };
    const route = json.data;
    return route && Array.isArray(route.polyline) && route.polyline.length >= 2 && Array.isArray(route.steps) ? route : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}

/** Tracé seul (cartes du dispatch). */
export async function fetchRoutePolyline(waypoints: RouteWaypoint[], signal?: AbortSignal): Promise<[number, number][] | null> {
  return (await fetchNavigationRoute(waypoints, signal))?.polyline ?? null;
}
