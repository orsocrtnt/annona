import { prisma } from "@/services/prisma/client";
import { ESTIMATION_MAX_SECONDS, trackingService } from "@/domains/tracking/tracking.policy";
import { fetchOsrmRoute } from "@/lib/maps/osrm-route";
import {
  DEMO_LOST_SIGNAL_AFTER_START_MS,
  DEMO_POSITION_MIN_INTERVAL_MS,
  demoSignalLagSeconds,
  demoTripProgress,
  demoTripStart,
  isDemoCompanyForSimulation,
  pointAlongPolyline,
} from "@/lib/demo/demo-live-position";

type Point = { latitude: number; longitude: number };

/** Itinéraires routiers des trajets simulés, gardés en mémoire : un seul appel par trajet. */
const routeCache = new Map<string, [number, number][]>();
const ROUTE_CACHE_LIMIT = 200;
let lastRouteRequestAt = 0;

async function demoTripRoute(start: Point, target: Point): Promise<[number, number][]> {
  const key = [start.latitude, start.longitude, target.latitude, target.longitude].map((v) => v.toFixed(5)).join(",");
  const cached = routeCache.get(key);
  if (cached) return cached;
  // Le service public d'itinéraires limite à une requête par seconde.
  const wait = lastRouteRequestAt + 1_150 - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRouteRequestAt = Date.now();
  const route = await fetchOsrmRoute([start, target]);
  // Sans itinéraire (service indisponible), ligne droite : la démo reste utilisable.
  const polyline: [number, number][] = route ?? [[start.latitude, start.longitude], [target.latitude, target.longitude]];
  if (route) {
    if (routeCache.size >= ROUTE_CACHE_LIMIT) routeCache.delete(routeCache.keys().next().value!);
    routeCache.set(key, polyline);
  }
  return polyline;
}

/**
 * Démo uniquement : fait rouler les livreurs des missions démarrées sur le vrai itinéraire
 * que trace la carte (vers la collecte pour une course, vers l'adresse pour une commande).
 * Un livreur à retard de signal (`demoSignalLagSeconds`) reçoit la position qu'il avait à ce
 * moment-là, datée d'autant : les cartes le montrent estimé. Au-delà de la durée d'estimation,
 * son relevé reste figé peu après le départ : « Signal perdu », il ne bouge plus, comme en réel.
 * Sans effet hors des entreprises de démo. Renvoie le nombre de positions écrites.
 */
export async function advanceDemoDriverPositions(companyId: string, now = new Date()): Promise<number> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { isDemo: true, slug: true },
  });
  if (!isDemoCompanyForSimulation(company)) return 0;

  const missions = await prisma.delivery.findMany({
    where: {
      companyId,
      status: { in: ["ASSIGNED", "PURCHASING", "IN_DELIVERY"] },
      missionStartedAt: { not: null },
      completedAt: null,
      driverId: { not: null },
      latitude: { not: null },
      longitude: { not: null },
    },
    select: {
      driverId: true,
      deliveryCategory: true,
      missionStartedAt: true,
      latitude: true,
      longitude: true,
      pickupLatitude: true,
      pickupLongitude: true,
      driver: { select: { settings: true, driverLocation: { select: { updatedAt: true } } } },
    },
    orderBy: { missionStartedAt: "asc" },
  });

  const seen = new Set<string>();
  let written = 0;
  for (const mission of missions) {
    const driverId = mission.driverId!;
    if (seen.has(driverId)) continue;
    seen.add(driverId);

    // Position à jour (à son retard près) et service actif : rien à réécrire. Juste après une
    // réinitialisation, la position existe mais le service n'est pas encore actif : on l'active.
    const trackingActive = trackingService(mission.driver?.settings).active;
    const lastUpdate = mission.driver?.driverLocation?.updatedAt;
    const lagSeconds = demoSignalLagSeconds(mission.driver?.settings);
    const startedAt = mission.missionStartedAt!.getTime();
    // Jamais avant le départ ni dans le futur : le signal doit appartenir à la mission en cours.
    const signalAt = lagSeconds > ESTIMATION_MAX_SECONDS
      ? new Date(Math.min(startedAt + DEMO_LOST_SIGNAL_AFTER_START_MS, now.getTime()))
      : new Date(Math.max(now.getTime() - lagSeconds * 1000, startedAt + 1000));
    if (trackingActive && lastUpdate && Math.abs(signalAt.getTime() - lastUpdate.getTime()) < DEMO_POSITION_MIN_INTERVAL_MS) continue;

    // Même cible que le tracé de la carte : la collecte d'abord pour une course.
    const target: Point =
      mission.deliveryCategory === "COURIER" && mission.pickupLatitude != null && mission.pickupLongitude != null
        ? { latitude: mission.pickupLatitude, longitude: mission.pickupLongitude }
        : { latitude: mission.latitude!, longitude: mission.longitude! };
    const route = await demoTripRoute(demoTripStart(target), target);
    const position = pointAlongPolyline(route, demoTripProgress(mission.missionStartedAt!, signalAt));

    // Le suivi n'est visible que si le service du livreur est actif (même règle qu'en réel).
    if (!trackingActive) {
      const settings = (mission.driver?.settings ?? {}) as Record<string, unknown>;
      await prisma.user.update({
        where: { id: driverId },
        data: {
          settings: {
            ...settings,
            trackingService: { active: true, startedAt: mission.missionStartedAt!.toISOString(), endedAt: null },
          },
        },
      });
    }

    await prisma.driverLocation.upsert({
      where: { driverId },
      create: { driverId, ...position, accuracy: 12, updatedAt: signalAt },
      update: { ...position, accuracy: 12, updatedAt: signalAt },
    });
    written += 1;
  }
  return written;
}
