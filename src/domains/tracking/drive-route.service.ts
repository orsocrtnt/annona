import type { TrackingPoint } from "@/domains/tracking/tracking.policy";
import { fetchDriveRoute } from "@/lib/maps/drive-route-provider";
import type { DriveRoute } from "@/lib/maps/drive-simulation";
import { buildRouteTrack, projectOnRoute, remainingPath, type LatLng, type RouteTrack } from "@/lib/maps/route-progress";

/**
 * Itinéraires des livreurs en mission, calculés par le serveur et gardés en mémoire : un appel
 * au fournisseur par livreur et par prochaine étape, réutilisé tant que ses relevés restent sur
 * la route. Les cartes reçoivent la route avec la position : aucun appel depuis le navigateur.
 */
const REUSE_MAX_OFFSET_METERS = 40;
const CACHE_LIMIT = 500;
/** Le service public d'itinéraires limite à une requête par seconde : appels en file. */
const REQUEST_SPACING_MS = 1_150;
/** Échec des deux fournisseurs : pas de nouvel essai pour ce livreur avant 30 s. */
const FAILURE_BACKOFF_MS = 30_000;
/** Attente maximale d'un itinéraire pendant une lecture ; au-delà, il servira à la suivante. */
export const ROUTE_WAIT_BUDGET_MS = 1_500;

type Entry = { targetKey: string; track: RouteTrack; lights: { point: LatLng; distance: number }[] };
const routes = new Map<string, Entry>();
const pending = new Map<string, Promise<void>>();
const failures = new Map<string, number>();
let queue: Promise<unknown> = Promise.resolve();

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const targetKey = (target: TrackingPoint) => `${target.latitude.toFixed(5)},${target.longitude.toFixed(5)}`;
const round = ([lat, lng]: LatLng): LatLng => [Math.round(lat * 1e5) / 1e5, Math.round(lng * 1e5) / 1e5];

/** Route restante depuis la projection du relevé, si l'itinéraire en mémoire convient encore. */
function cachedRoute(driverId: string, from: TrackingPoint, target: TrackingPoint): DriveRoute | null {
  const entry = routes.get(driverId);
  if (!entry || entry.targetKey !== targetKey(target)) return null;
  const projected = projectOnRoute(entry.track, [from.latitude, from.longitude]);
  if (projected.offsetMeters > REUSE_MAX_OFFSET_METERS) return null;
  return {
    points: remainingPath(entry.track, projected.distance).map(round),
    lights: entry.lights.filter((light) => light.distance > projected.distance).map((light) => light.point),
  };
}

function store(driverId: string, target: TrackingPoint, route: DriveRoute) {
  if (!routes.has(driverId) && routes.size >= CACHE_LIMIT) routes.delete(routes.keys().next().value!);
  const track = buildRouteTrack(route.points);
  routes.set(driverId, {
    targetKey: targetKey(target),
    track,
    lights: route.lights.map((point) => ({ point, distance: projectOnRoute(track, point).distance })),
  });
}

/**
 * Itinéraire du livreur depuis son dernier relevé vers sa prochaine étape. Sans itinéraire en
 * mémoire, un calcul est lancé et attendu au plus `budgetMs` ; null si rien n'est prêt (le
 * livreur reste alors à son dernier point, jamais en ligne droite).
 */
export async function getDriveRoute(
  driverId: string,
  from: TrackingPoint,
  target: TrackingPoint,
  budgetMs = ROUTE_WAIT_BUDGET_MS
): Promise<DriveRoute | null> {
  const hit = cachedRoute(driverId, from, target);
  if (hit) return hit;
  const key = `${driverId}|${targetKey(target)}`;
  if (Date.now() - (failures.get(key) ?? 0) < FAILURE_BACKOFF_MS) return null;
  let job = pending.get(key);
  if (!job) {
    const run = queue.then(() => fetchDriveRoute(from, target));
    queue = run.then(() => wait(REQUEST_SPACING_MS), () => wait(REQUEST_SPACING_MS));
    job = run
      .then((route) => {
        if (route) {
          store(driverId, target, route);
          failures.delete(key);
        } else {
          failures.set(key, Date.now());
        }
      })
      .catch(() => {
        failures.set(key, Date.now());
      })
      .finally(() => pending.delete(key));
    pending.set(key, job);
  }
  await Promise.race([job, wait(budgetMs)]);
  return cachedRoute(driverId, from, target);
}
