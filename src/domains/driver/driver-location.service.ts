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
};

export async function upsertDriverLocation(
  driverId: string,
  data: UpdateDriverLocationInput
) {
  return prisma.driverLocation.upsert({
    where: { driverId },
    create: {
      driverId,
      latitude: data.latitude,
      longitude: data.longitude,
      accuracy: data.accuracy,
    },
    update: {
      latitude: data.latitude,
      longitude: data.longitude,
      accuracy: data.accuracy,
    },
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
              status: { in: ["ASSIGNED", "PURCHASING", "IN_DELIVERY"] },
            },
          },
        },
      },
    },
    orderBy: { firstName: "asc" },
  });

  const now = Date.now();
  const onlineThresholdMs = onlineThresholdSeconds * 1000;

  return drivers.map((driver) => {
    const loc = driver.driverLocation;
    const updatedAt = loc?.updatedAt ?? null;
    const isOnline =
      !!updatedAt && now - updatedAt.getTime() < onlineThresholdMs;

    return {
      id: driver.id,
      name: formatDriverDisplayName(`${driver.firstName} ${driver.lastName}`.trim()),
      latitude: loc?.latitude ?? null,
      longitude: loc?.longitude ?? null,
      accuracy: loc?.accuracy ?? null,
      updatedAt: updatedAt?.toISOString() ?? null,
      activeMissions: driver._count.deliveriesAsDriver,
      isOnline,
    };
  });
}
