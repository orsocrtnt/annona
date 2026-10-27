import { prisma } from "@/services/prisma/client";
import { trackingService } from "@/domains/tracking/tracking.policy";
import {
  DEMO_POSITION_MIN_INTERVAL_MS,
  demoDriverPosition,
  demoStartPoint,
  isDemoCompanyForSimulation,
} from "@/lib/demo/demo-live-position";

/**
 * Démo uniquement : fait avancer les livreurs des missions démarrées pour que les cartes
 * montrent des positions en direct. Sans effet hors des entreprises de démo.
 * Renvoie le nombre de positions écrites.
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

    // Position récente et service actif : rien à réécrire. Juste après une réinitialisation,
    // la position existe mais le service n'est pas encore actif : on l'active tout de suite.
    const trackingActive = trackingService(mission.driver?.settings).active;
    const lastUpdate = mission.driver?.driverLocation?.updatedAt;
    if (trackingActive && lastUpdate && now.getTime() - lastUpdate.getTime() < DEMO_POSITION_MIN_INTERVAL_MS) continue;

    const destination = { latitude: mission.latitude!, longitude: mission.longitude! };
    const pickup =
      mission.pickupLatitude != null && mission.pickupLongitude != null
        ? { latitude: mission.pickupLatitude, longitude: mission.pickupLongitude }
        : null;
    const position = demoDriverPosition(demoStartPoint(destination, pickup), destination, mission.missionStartedAt!, now);

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
      create: { driverId, ...position, accuracy: 12 },
      update: { ...position, accuracy: 12 },
    });
    written += 1;
  }
  return written;
}
