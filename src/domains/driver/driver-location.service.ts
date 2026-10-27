import { resolveTrackingPosition } from "@/domains/tracking/tracking-position.service";
import { trackingService, trackingTarget, type TrackingMotion } from "@/domains/tracking/tracking.policy";
import { transaction, ConversationError } from "@/domains/order-conversation/order-conversation.service";
import { prisma } from "@/services/prisma/client";
import type { UpdateDriverLocationInput } from "@/lib/validations/driver-location";
import { DEFAULT_DRIVER_LOCATION_SETTINGS } from "@/lib/validations/driver-location-settings";
import { formatDriverDisplayName } from "@/lib/format/person-labels";

export type LiveDriverLocation = {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  updatedAt: string | null;
  activeMissions: number;
  isOnline: boolean;
  /** Signal perdu depuis peu : position estimée vers la prochaine étape, pas un relevé GPS. */
  estimated: boolean;
  /** Trajet supposé vers la prochaine étape : la carte fait avancer le livreur entre deux signaux. */
  motion: TrackingMotion | null;
  positionState: string;
};

export async function upsertDriverLocation(driverId: string, companyId: string, data: UpdateDriverLocationInput) {
  return transaction(async tx => {
    const driver = await tx.user.findFirst({ where: { id: driverId, companyId, status: "ACTIVE", role: { systemRole: "DRIVER" } }, select: { settings: true, updatedAt: true } });
    if (!driver || !trackingService(driver.settings).active) throw new ConversationError(409, "Service arrêté : position non enregistrée.");
    const mission = await tx.delivery.findFirst({ where: { driverId, companyId, status: { in: ["ASSIGNED", "PURCHASING", "IN_DELIVERY"] }, missionStartedAt: { not: null }, completedAt: null }, select: { id: true, updatedAt: true } });
    if (!mission) throw new ConversationError(409, "Aucune mission démarrée : position non enregistrée.");
    // Same driver lock as service closure; delivery lock serializes completion.
    const claimed = await tx.delivery.updateMany({ where: { id: mission.id, driverId, companyId, updatedAt: mission.updatedAt, completedAt: null }, data: { updatedAt: mission.updatedAt } });
    const locked = await tx.user.updateMany({ where: { id: driverId, companyId, updatedAt: driver.updatedAt }, data: { updatedAt: driver.updatedAt } });
    if (locked.count !== 1 || claimed.count !== 1) throw new ConversationError(409, "La mission ou le service a changé.");
    return tx.driverLocation.upsert({ where: { driverId }, create: { driverId, ...data }, update: data });
  });
}

export async function getCompanyDriverLocations(
  companyId: string,
  onlineThresholdSeconds = DEFAULT_DRIVER_LOCATION_SETTINGS.onlineThresholdSeconds
): Promise<LiveDriverLocation[]> {
  const drivers = await prisma.user.findMany({
    where: {
      companyId,
      status: "ACTIVE",
      role: { systemRole: "DRIVER" },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      status: true,
      settings: true,
      deliveriesAsDriver: {
        where: { companyId, status: { in: ["ASSIGNED", "PURCHASING", "IN_DELIVERY"] }, missionStartedAt: { not: null }, completedAt: null },
        // La mission démarrée la première est celle en cours : elle donne la prochaine étape de l'estimation.
        orderBy: [{ missionStartedAt: "asc" }, { id: "asc" }],
        select: {
          status: true, missionStartedAt: true, completedAt: true, deliveryCategory: true,
          latitude: true, longitude: true, pickupLatitude: true, pickupLongitude: true,
          order: { select: { stops: { orderBy: { sequence: "asc" }, select: { latitude: true, longitude: true } } } },
        },
      },
      driverLocation: {
        select: {
          latitude: true,
          longitude: true,
          accuracy: true,
          updatedAt: true,
        },
      },
      _count: {
        select: {
          deliveriesAsDriver: {
            where: {
              companyId,
              status: { in: ["ASSIGNED", "PURCHASING", "IN_DELIVERY"] },
            },
          },
        },
      },
    },
    orderBy: { firstName: "asc" },
  });

  const now = new Date();
  return Promise.all(drivers.map(async (driver) => {
    const started = driver.deliveriesAsDriver[0];
    const mission = started ?? { status: "ASSIGNED", missionStartedAt: null };
    const position = await resolveTrackingPosition(driver.id, mission, driver, onlineThresholdSeconds, now, started ? trackingTarget(started) : null);
    return {
      id: driver.id,
      name: formatDriverDisplayName(`${driver.firstName} ${driver.lastName}`.trim()),
      latitude: position.latitude, longitude: position.longitude, accuracy: position.accuracy,
      updatedAt: position.updatedAt, activeMissions: driver._count.deliveriesAsDriver,
      isOnline: position.state === "FRESH", estimated: position.estimated, motion: position.motion, positionState: position.state,
    };
  }));
}
