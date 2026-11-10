/**
 * Lot 1, demande 5 — suivi des livreurs (administrateur, et mini admin qui a la fonctionnalité).
 *
 * Pour chaque livreur dont la tournée du jour est démarrée (IN_PROGRESS) :
 * - sa position, seulement si elle a été reçue depuis le démarrage de cette tournée (ENF-04, RGPD :
 *   jamais en dehors d'une tournée ; la position est effacée quand la tournée se termine) ; au-delà de
 *   `STALE_AFTER_MS` sans nouvelle position (réseau perdu), elle est marquée « dernière position connue » ;
 * - ses prochains arrêts dans l'ordre de la tournée, le nombre de clients qui restent à livrer, les
 *   arrêts livrés avec l'heure, les problèmes signalés ;
 * - le trajet de sa position (ou du laboratoire) jusqu'à ses `ROUTE_STOPS` prochains arrêts : itinéraire du
 *   fournisseur configuré côté serveur (LEGAL-1), sinon segments droits marqués « approximatif ».
 *
 * L'écran interroge cette lecture toutes les 15 s ; le livreur envoie sa position au moins toutes les 30 s.
 */
import type { PrismaClient, StopStatus } from "@prisma/client";
import { prisma } from "@/services/prisma/client";
import { slotLabel } from "@/domains/order/merchant-order.service";
import { companyToday, deliveryDateToDb } from "@/domains/order/order-deadline";
import { loadStopDetails } from "@/domains/round/round-admin.service";
import { DomainRuleError } from "@/lib/errors/domain-rule-error";
import type { RouteWaypoint } from "@/lib/maps/navigation-route";

export type TrackingDb = Pick<PrismaClient, "company" | "slot" | "round" | "stop" | "order" | "orderLine" | "merchant" | "user" | "driverLocation">;

/** Au-delà, la position est la « dernière position connue » (le livreur envoie toutes les 30 s au plus tard). */
export const STALE_AFTER_MS = 90_000;
/** Nombre de prochains arrêts reliés par le trajet affiché. */
export const ROUTE_STOPS = 3;

export interface TrackingStop {
  id: string;
  sequence: number;
  status: StopStatus;
  merchantName: string;
  latitude: number | null;
  longitude: number | null;
  estimatedArrivalAt: string | null;
  deliveredAt: string | null;
  incidentAt: string | null;
}

export interface TrackedDriver {
  /** Identifiant de la tournée suivie (un livreur peut faire le matin puis le soir). */
  roundId: string;
  driverId: string;
  driverName: string;
  roundName: string;
  slotLabel: string;
  startedAt: string | null;
  position: { latitude: number; longitude: number; updatedAt: string; stale: boolean } | null;
  /** Arrêts à livrer, dans l'ordre de la tournée. */
  nextStops: TrackingStop[];
  remainingCount: number;
  /** Arrêts livrés, du plus ancien au plus récent, avec l'heure. */
  delivered: TrackingStop[];
  incidents: TrackingStop[];
  /** Trajet affiché : position (ou laboratoire), puis les prochains arrêts localisés. */
  route: { from: "driver" | "depot" | null; waypoints: RouteWaypoint[]; polyline: [number, number][] | null; approximate: boolean };
}

export interface DriverTracking {
  date: string;
  generatedAt: string;
  depot: { latitude: number; longitude: number } | null;
  drivers: TrackedDriver[];
}

type RouteFetcher = (waypoints: RouteWaypoint[]) => Promise<{ polyline: [number, number][] } | null>;

/** Points du trajet : départ puis au plus `ROUTE_STOPS` prochains arrêts localisés, dans l'ordre. */
export function routeWaypoints(start: { latitude: number; longitude: number } | null, nextStops: readonly TrackingStop[]): RouteWaypoint[] {
  const stops = nextStops
    .filter((stop) => stop.latitude !== null && stop.longitude !== null)
    .slice(0, ROUTE_STOPS)
    .map((stop) => ({ latitude: stop.latitude!, longitude: stop.longitude!, label: stop.merchantName }));
  return start && stops.length > 0 ? [{ latitude: start.latitude, longitude: start.longitude }, ...stops] : [];
}

// Itinéraires mémorisés par instance (position arrondie à ~100 m) : un livreur arrêté ne relance aucun calcul.
const ROUTE_CACHE_TTL_MS = 5 * 60_000;
const routeCache = new Map<string, { until: number; polyline: [number, number][] | null }>();

/** Vide le cache des itinéraires (tests). */
export function clearRouteCache() {
  routeCache.clear();
}

function routeKey(waypoints: readonly RouteWaypoint[]) {
  return waypoints.map((point) => `${point.latitude.toFixed(3)},${point.longitude.toFixed(3)}`).join(";");
}

async function cachedRoute(waypoints: RouteWaypoint[], fetchRoute: RouteFetcher, now: number) {
  const key = routeKey(waypoints);
  const hit = routeCache.get(key);
  if (hit && hit.until > now) return hit.polyline;
  const polyline = (await fetchRoute(waypoints).catch(() => null))?.polyline ?? null;
  if (routeCache.size > 500) routeCache.clear();
  routeCache.set(key, { until: now + ROUTE_CACHE_TTL_MS, polyline });
  return polyline;
}

async function defaultRouteFetcher(waypoints: RouteWaypoint[]) {
  const { fetchServerNavigationRoute } = await import("@/lib/maps/server-navigation-route");
  return fetchServerNavigationRoute(waypoints);
}

export async function getDriverTracking(
  companyId: string,
  options: { now?: Date; db?: TrackingDb; fetchRoute?: RouteFetcher } = {}
): Promise<DriverTracking> {
  const db = options.db ?? (prisma as unknown as TrackingDb);
  const now = options.now ?? new Date();
  const fetchRoute = options.fetchRoute ?? defaultRouteFetcher;
  const company = await db.company.findUnique({ where: { id: companyId }, select: { timezone: true, depotLatitude: true, depotLongitude: true } });
  if (!company) throw new DomainRuleError(404, "Entreprise introuvable.", "COMPANY_NOT_FOUND");
  const date = companyToday(now, company.timezone);
  const depot = company.depotLatitude !== null && company.depotLongitude !== null ? { latitude: company.depotLatitude, longitude: company.depotLongitude } : null;

  // Tournées démarrées du jour avec un livreur (une tournée d'hier encore ouverte n'est pas suivie).
  const rounds = (await db.round.findMany({
    where: { companyId, date: deliveryDateToDb(date), status: "IN_PROGRESS" },
    select: { id: true, name: true, slotId: true, driverId: true, startedAt: true },
  })).filter((round): round is typeof round & { driverId: string } => Boolean(round.driverId));
  if (rounds.length === 0) return { date, generatedAt: now.toISOString(), depot, drivers: [] };

  const driverIds = [...new Set(rounds.map((round) => round.driverId))];
  const [stops, drivers, locations, slots] = await Promise.all([
    db.stop.findMany({
      where: { companyId, roundId: { in: rounds.map((round) => round.id) } },
      select: {
        id: true, roundId: true, orderId: true, sequence: true, status: true, estimatedArrivalAt: true, deliveredAt: true,
        incidentCode: true, incidentComment: true, incidentPhotoPath: true, incidentAt: true,
      },
    }),
    db.user.findMany({ where: { companyId, id: { in: driverIds } }, select: { id: true, firstName: true, lastName: true } }),
    db.driverLocation.findMany({ where: { companyId, driverId: { in: driverIds } }, select: { driverId: true, latitude: true, longitude: true, updatedAt: true } }),
    db.slot.findMany({ where: { companyId, id: { in: [...new Set(rounds.map((round) => round.slotId))] } }, select: { id: true, label: true, startTime: true, endTime: true } }),
  ]);
  const { views } = await loadStopDetails(db, companyId, stops);
  const nameOf = new Map(drivers.map((driver) => [driver.id, `${driver.firstName} ${driver.lastName}`.trim()]));
  const locationOf = new Map(locations.map((location) => [location.driverId, location]));
  const slotOf = new Map(slots.map((slot) => [slot.id, slot]));

  const tracked = await Promise.all(
    rounds.map(async (round): Promise<TrackedDriver> => {
      const own = stops
        .filter((stop) => stop.roundId === round.id)
        .sort((a, b) => a.sequence - b.sequence)
        .map((stop): TrackingStop => {
          const view = views.get(stop.id);
          return {
            id: stop.id,
            sequence: stop.sequence,
            status: stop.status,
            merchantName: view?.merchantName ?? "",
            latitude: view?.latitude ?? null,
            longitude: view?.longitude ?? null,
            estimatedArrivalAt: stop.estimatedArrivalAt?.toISOString() ?? null,
            deliveredAt: stop.deliveredAt?.toISOString() ?? null,
            incidentAt: stop.incidentAt?.toISOString() ?? null,
          };
        });
      const location = locationOf.get(round.driverId);
      // ENF-04 : seulement une position reçue depuis le démarrage de cette tournée.
      const position =
        location && round.startedAt && location.updatedAt >= round.startedAt
          ? {
              latitude: location.latitude,
              longitude: location.longitude,
              updatedAt: location.updatedAt.toISOString(),
              stale: now.getTime() - location.updatedAt.getTime() > STALE_AFTER_MS,
            }
          : null;
      const nextStops = own.filter((stop) => stop.status === "PENDING");
      const start = position ?? depot;
      const waypoints = routeWaypoints(start, nextStops);
      const polyline = waypoints.length >= 2 ? await cachedRoute(waypoints, fetchRoute, now.getTime()) : null;
      const slot = slotOf.get(round.slotId);
      return {
        roundId: round.id,
        driverId: round.driverId,
        driverName: nameOf.get(round.driverId) ?? "",
        roundName: round.name ?? "",
        slotLabel: slot ? slotLabel(slot) : "",
        startedAt: round.startedAt?.toISOString() ?? null,
        position,
        nextStops,
        remainingCount: nextStops.length,
        delivered: own
          .filter((stop) => stop.status === "DELIVERED")
          .sort((a, b) => (a.deliveredAt ?? "").localeCompare(b.deliveredAt ?? "") || a.sequence - b.sequence),
        incidents: own.filter((stop) => stop.status === "INCIDENT"),
        route: {
          from: waypoints.length === 0 ? null : position ? "driver" : "depot",
          waypoints,
          polyline: polyline ?? (waypoints.length >= 2 ? waypoints.map((point) => [point.latitude, point.longitude] as [number, number]) : null),
          approximate: waypoints.length >= 2 && !polyline,
        },
      };
    })
  );
  tracked.sort((a, b) => a.driverName.localeCompare(b.driverName, "fr") || a.roundName.localeCompare(b.roundName, "fr"));
  return { date, generatedAt: now.toISOString(), depot, drivers: tracked };
}
