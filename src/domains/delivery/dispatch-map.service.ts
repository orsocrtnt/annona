import { getCompanyDriverLocations } from "@/domains/driver/driver-location.service";
import { getCompanyLocationSettings } from "@/domains/company/location-settings.service";
import { trackingPosition, trackingTarget, type TrackingMotion } from "@/domains/tracking/tracking.policy";
import { prisma } from "@/services/prisma/client";
import type { DeliveryCategory, DeliveryStatus } from "@prisma/client";
import { geocodeManyCapped, isLegacyFakeTrackingCoord } from "@/lib/geocoding";
import { getFulfillmentStatusLabel } from "@/lib/constants/order-status";
import { DEFAULT_DRIVER_LOCATION_SETTINGS } from "@/lib/validations/driver-location-settings";
import {
  formatClientFromParts,
  formatDriverDisplayName,
} from "@/lib/format/person-labels";

const MAP_ACTIVE_STATUSES: DeliveryStatus[] = [
  "PENDING",
  "ASSIGNED",
  "PURCHASING",
  "IN_DELIVERY",
];

const MAP_HISTORY_STATUSES: DeliveryStatus[] = ["DELIVERED", "INVOICED", "PAID", "CANCELLED", "FAILED"];

const CLIENT_MAP_HISTORY_LIMIT = 40;

export type DispatchMapPointKind =
  | "destination"
  | "pickup"
  | "driver";

export type DispatchMapTrackingStep = {
  id: string;
  label: string;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  occurredAt: string;
};

export type DispatchMapOrderItem = {
  id: string;
  name: string;
  quantity: number;
};

export type DispatchMapDriverLocation = {
  latitude: number;
  longitude: number;
  updatedAt: string;
  isOnline: boolean;
  /** Signal perdu depuis peu : position estimée vers la prochaine étape, pas un relevé GPS. */
  estimated: boolean;
  /** Trajet supposé vers la prochaine étape : la carte fait avancer le livreur entre deux signaux. */
  motion: TrackingMotion | null;
};

export type DispatchMapPoint = {
  id: string;
  deliveryId: string;
  kind: DispatchMapPointKind;
  latitude: number;
  longitude: number;
  reference: string;
  status: DeliveryStatus;
  deliveryCategory: DeliveryCategory;
  driverName: string | null;
  address: string;
  label: string;
};

export type DispatchMapPickup = {
  id: string;
  latitude: number;
  longitude: number;
  address: string;
  label: string;
};

export type DispatchMapDelivery = {
  id: string;
  reference: string;
  orderId: string;
  requestedDeliveryDate: string | null;
  status: DeliveryStatus;
  statusLabel: string;
  deliveryCategory: DeliveryCategory;
  driverId: string | null;
  driverName: string | null;
  customerName: string | null;
  driverLocation: DispatchMapDriverLocation | null;
  positionState: string;
  positionUpdatedAt: string | null;
  address: string;
  pickupAddress: string | null;
  destination: { latitude: number; longitude: number } | null;
  pickup: { latitude: number; longitude: number } | null;
  pickups: DispatchMapPickup[];
  trackingSteps: DispatchMapTrackingStep[];
  orderItems: DispatchMapOrderItem[];
  missionStartedAt: string | null;
  missionAcceptedAt: string | null;
  isHistorical: boolean;
  completedAt: string | null;
  createdAt: string;
};

export type DispatchDriverMapEntry = {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  updatedAt: string | null;
  positionState: string;
  estimated: boolean;
  assigned: number;
  inTransit: number;
  missions: {
    deliveryId: string;
    reference: string;
    status: DeliveryStatus;
    statusLabel: string;
    deliveryCategory: DeliveryCategory;
    address: string;
    latitude: number | null;
    longitude: number | null;
  }[];
};

function formatAddress(parts: (string | null | undefined)[]) {
  return parts.filter(Boolean).join(", ");
}

function statusLabel(status: DeliveryStatus, category: DeliveryCategory) {
  return getFulfillmentStatusLabel(status, category);
}

function resolveCustomerName(delivery: {
  customer: { firstName: string; lastName: string } | null;
  order: {
    customerEmail: string | null;
    customer: { firstName: string; lastName: string } | null;
  };
}) {
  const customer = delivery.customer ?? delivery.order.customer;
  return formatClientFromParts(customer, delivery.order.customerEmail) || null;
}

function resolveDriverName(driverName: string | null | undefined) {
  return driverName ? formatDriverDisplayName(driverName) : null;
}

function isMissingColumnError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2022"
  );
}

/**
 * Schema may include Delivery/OrderStop lat/lng before `db:push` lands them.
 * After the first P2022, prefer the legacy select until process restart.
 */
let preferLegacyMapSelect = false;

const MAP_DELIVERY_SELECT_LEGACY = {
  id: true,
  companyId: true,
  reference: true,
  status: true,
  deliveryCategory: true,
  address: true,
  city: true,
  postalCode: true,
  pickupAddress: true,
  pickupCity: true,
  pickupPostalCode: true,
  driverId: true,
  driverName: true,
  missionStartedAt: true,
  missionAcceptedAt: true,
  completedAt: true,
  createdAt: true,
  customer: {
    select: { firstName: true, lastName: true },
  },
  driver: {
    select: {
      status: true, settings: true, companyId: true,
      driverLocation: {
        select: { latitude: true, longitude: true, updatedAt: true },
      },
    },
  },
  order: {
    select: {
      id: true,
      requestedDeliveryDate: true,
      customerEmail: true,
      customer: { select: { firstName: true, lastName: true } },
      items: {
        select: { id: true, name: true, quantity: true },
        orderBy: { name: "asc" as const },
      },
      stops: {
        orderBy: { sequence: "asc" as const },
        select: {
          id: true,
          label: true,
          address: true,
          city: true,
          postalCode: true,
        },
      },
    },
  },
  trackingEvents: {
    orderBy: { occurredAt: "asc" as const },
    select: {
      id: true,
      label: true,
      description: true,
      latitude: true,
      longitude: true,
      occurredAt: true,
    },
  },
} as const;

const MAP_DELIVERY_SELECT = {
  id: true,
  companyId: true,
  reference: true,
  status: true,
  deliveryCategory: true,
  address: true,
  city: true,
  postalCode: true,
  latitude: true,
  longitude: true,
  pickupAddress: true,
  pickupCity: true,
  pickupPostalCode: true,
  pickupLatitude: true,
  pickupLongitude: true,
  driverId: true,
  driverName: true,
  missionStartedAt: true,
  missionAcceptedAt: true,
  completedAt: true,
  createdAt: true,
  customer: {
    select: { firstName: true, lastName: true },
  },
  driver: {
    select: {
      status: true, settings: true, companyId: true,
      driverLocation: {
        select: { latitude: true, longitude: true, updatedAt: true },
      },
    },
  },
  order: {
    select: {
      id: true,
      requestedDeliveryDate: true,
      customerEmail: true,
      customer: { select: { firstName: true, lastName: true } },
      items: {
        select: { id: true, name: true, quantity: true },
        orderBy: { name: "asc" as const },
      },
      stops: {
        orderBy: { sequence: "asc" as const },
        select: {
          id: true,
          label: true,
          address: true,
          city: true,
          postalCode: true,
          latitude: true,
          longitude: true,
        },
      },
    },
  },
  trackingEvents: {
    orderBy: { occurredAt: "asc" as const },
    select: {
      id: true,
      label: true,
      description: true,
      latitude: true,
      longitude: true,
      occurredAt: true,
    },
  },
} as const;

type MapDeliveryRecord = Awaited<
  ReturnType<
    typeof prisma.delivery.findMany<{ select: typeof MAP_DELIVERY_SELECT; take: 1 }>
  >
>[number];

type MapDeliveryLegacyRecord = Awaited<
  ReturnType<
    typeof prisma.delivery.findMany<{ select: typeof MAP_DELIVERY_SELECT_LEGACY; take: 1 }>
  >
>[number];

function normalizeLegacyMapDelivery(delivery: MapDeliveryLegacyRecord): MapDeliveryRecord {
  return {
    ...delivery,
    latitude: null,
    longitude: null,
    pickupLatitude: null,
    pickupLongitude: null,
    order: {
      ...delivery.order,
      stops: delivery.order.stops.map((stop) => ({
        ...stop,
        latitude: null,
        longitude: null,
      })),
    },
  } as MapDeliveryRecord;
}

async function findManyMapDeliveries(args: {
  where: {
    companyId?: string;
    customerId?: string;
    status?: { in: DeliveryStatus[] };
  };
  orderBy:
    | { createdAt: "desc" | "asc" }
    | Array<{ completedAt: "desc" | "asc" } | { createdAt: "desc" | "asc" }>;
  take?: number;
}): Promise<MapDeliveryRecord[]> {
  // Ownership must agree on both the delivery and its parent order.
  const scopedArgs = { ...args, where: { ...args.where, ...(args.where.customerId ? { order: { customerId: args.where.customerId, companyId: args.where.companyId } } : {}) } };
  if (!preferLegacyMapSelect) {
    try {
      return await prisma.delivery.findMany({
        ...scopedArgs,
        select: MAP_DELIVERY_SELECT,
      });
    } catch (error) {
      if (!isMissingColumnError(error)) throw error;
      preferLegacyMapSelect = true;
      console.warn(
        "[dispatch-map] Delivery/OrderStop coordinate columns missing in DB; falling back to geocode path"
      );
    }
  }

  const rows = await prisma.delivery.findMany({
    ...scopedArgs,
    select: MAP_DELIVERY_SELECT_LEGACY,
  });
  return rows.map(normalizeLegacyMapDelivery);
}

async function fetchActiveMapDeliveries(
  where: { companyId: string } | { customerId: string; companyId: string }
): Promise<MapDeliveryRecord[]> {
  const deliveries = await findManyMapDeliveries({
    where: {
      ...where,
      status: { in: MAP_ACTIVE_STATUSES },
    },
    orderBy: { createdAt: "desc" },
  });

  if ("customerId" in where) {
    const { repairCourierDeliveryIfNeeded } = await import(
      "@/domains/delivery/delivery.service"
    );
    await Promise.all(
      deliveries
        .filter(
          (delivery) =>
            delivery.deliveryCategory === "COURIER" &&
            (!delivery.pickupAddress?.trim() ||
              !delivery.trackingEvents.some((event) => event.label === "Livraison"))
        )
        .map((delivery) =>
          repairCourierDeliveryIfNeeded(delivery.id, where.customerId, where.companyId)
        )
    );

    if (
      deliveries.some(
        (delivery) =>
          delivery.deliveryCategory === "COURIER" &&
          (!delivery.pickupAddress?.trim() ||
            !delivery.trackingEvents.some((event) => event.label === "Livraison"))
      )
    ) {
      return findManyMapDeliveries({
        where: {
          ...where,
          status: { in: MAP_ACTIVE_STATUSES },
        },
        orderBy: { createdAt: "desc" },
      });
    }
  }

  return deliveries;
}

async function buildDeliveriesMapPayload(
  deliveries: MapDeliveryRecord[],
  onlineThresholdSeconds: number,
  options?: { isHistorical?: boolean; exposeTrackingCoordinates?: boolean }
): Promise<{ deliveries: DispatchMapDelivery[]; points: DispatchMapPoint[] }> {
  const isHistorical = options?.isHistorical ?? false;
  const now = new Date();

  const geocodeEntries: {
    key: string;
    parts: { address?: string | null; postalCode?: string | null; city?: string | null };
  }[] = [];

  for (const delivery of deliveries) {
    if (delivery.latitude == null || delivery.longitude == null) {
      geocodeEntries.push({
        key: `${delivery.id}-dest`,
        parts: {
          address: delivery.address,
          postalCode: delivery.postalCode,
          city: delivery.city,
        },
      });
    }

    if (delivery.deliveryCategory !== "COURIER") continue;

    const stops = delivery.order.stops;
    if (stops.length > 0) {
      for (const stop of stops) {
        if (stop.latitude == null || stop.longitude == null) {
          geocodeEntries.push({
            key: `${delivery.id}-pickup-${stop.id}`,
            parts: {
              address: stop.address,
              postalCode: stop.postalCode,
              city: stop.city,
            },
          });
        }
      }
    } else if (
      delivery.pickupAddress?.trim() &&
      (delivery.pickupLatitude == null || delivery.pickupLongitude == null)
    ) {
      geocodeEntries.push({
        key: `${delivery.id}-pickup`,
        parts: {
          address: delivery.pickupAddress,
          postalCode: delivery.pickupPostalCode,
          city: delivery.pickupCity,
        },
      });
    }
  }

  const coordsByKey =
    geocodeEntries.length > 0
      ? await geocodeManyCapped(geocodeEntries)
      : new Map<string, { lat: number; lng: number }>();

  // Persiste les coords manquantes pour que les prochains polls serverless soient gratuits
  // Skip when DB lacks the columns (legacy fallback path).
  if (coordsByKey.size > 0 && !preferLegacyMapSelect) {
    const persistTasks: Promise<unknown>[] = [];

    for (const delivery of deliveries) {
      const destCoords = coordsByKey.get(`${delivery.id}-dest`);
      const pickupCoords = coordsByKey.get(`${delivery.id}-pickup`);
      const deliveryUpdate: {
        latitude?: number;
        longitude?: number;
        pickupLatitude?: number;
        pickupLongitude?: number;
      } = {};

      if (destCoords && (delivery.latitude == null || delivery.longitude == null)) {
        deliveryUpdate.latitude = destCoords.lat;
        deliveryUpdate.longitude = destCoords.lng;
      }
      if (
        pickupCoords &&
        (delivery.pickupLatitude == null || delivery.pickupLongitude == null)
      ) {
        deliveryUpdate.pickupLatitude = pickupCoords.lat;
        deliveryUpdate.pickupLongitude = pickupCoords.lng;
      }

      if (Object.keys(deliveryUpdate).length > 0) {
        persistTasks.push(
          prisma.delivery.update({
            where: { id: delivery.id },
            data: deliveryUpdate,
          })
        );
      }

      for (const stop of delivery.order.stops) {
        const stopCoords = coordsByKey.get(`${delivery.id}-pickup-${stop.id}`);
        if (!stopCoords || (stop.latitude != null && stop.longitude != null)) continue;
        persistTasks.push(
          prisma.orderStop.update({
            where: { id: stop.id },
            data: { latitude: stopCoords.lat, longitude: stopCoords.lng },
          })
        );
      }
    }

    void Promise.all(persistTasks).catch((error) => {
      if (isMissingColumnError(error)) {
        preferLegacyMapSelect = true;
        console.warn(
          "[dispatch-map] Coordinate columns missing while persisting; switching to legacy path"
        );
        return;
      }
      console.warn("[dispatch-map] Failed to persist geocoded coordinates", error);
    });
  }

  const result: DispatchMapDelivery[] = [];
  const points: DispatchMapPoint[] = [];

  for (const delivery of deliveries) {
    const destCoords =
      delivery.latitude != null && delivery.longitude != null
        ? { lat: delivery.latitude, lng: delivery.longitude }
        : coordsByKey.get(`${delivery.id}-dest`);
    const destAddress = formatAddress([delivery.address, delivery.postalCode, delivery.city]);
    const driverName = resolveDriverName(delivery.driverName);
    const customerName = resolveCustomerName(delivery);

    let pickupCoords: { lat: number; lng: number } | null = null;
    let pickupAddress: string | null = null;
    const pickups: DispatchMapPickup[] = [];

    if (delivery.deliveryCategory === "COURIER") {
      const stops = delivery.order.stops;
      if (stops.length > 0) {
        for (const stop of stops) {
          const coords =
            stop.latitude != null && stop.longitude != null
              ? { lat: stop.latitude, lng: stop.longitude }
              : coordsByKey.get(`${delivery.id}-pickup-${stop.id}`);
          const address = formatAddress([stop.address, stop.postalCode, stop.city]);
          if (!coords) continue;
          pickups.push({
            id: stop.id,
            latitude: coords.lat,
            longitude: coords.lng,
            address,
            label: stop.label?.trim() || `Collecte ${pickups.length + 1}`,
          });
        }
        pickupCoords = pickups[0] ? { lat: pickups[0].latitude, lng: pickups[0].longitude } : null;
        pickupAddress = pickups[0]?.address ?? null;
      } else {
        pickupCoords =
          delivery.pickupLatitude != null && delivery.pickupLongitude != null
            ? { lat: delivery.pickupLatitude, lng: delivery.pickupLongitude }
            : (coordsByKey.get(`${delivery.id}-pickup`) ?? null);
        pickupAddress = formatAddress([
          delivery.pickupAddress,
          delivery.pickupPostalCode,
          delivery.pickupCity,
        ]);
        if (pickupCoords && pickupAddress) {
          pickups.push({
            id: `${delivery.id}-pickup`,
            latitude: pickupCoords.lat,
            longitude: pickupCoords.lng,
            address: pickupAddress,
            label: "Collecte",
          });
        }
      }
    }

    // Coordonnées résolues (y compris géocodées à l'instant) : même cible que le tracé de la carte.
    const target = trackingTarget({
      status: delivery.status,
      deliveryCategory: delivery.deliveryCategory,
      latitude: destCoords?.lat ?? null,
      longitude: destCoords?.lng ?? null,
      pickupLatitude: pickupCoords?.lat ?? null,
      pickupLongitude: pickupCoords?.lng ?? null,
    });
    const position = trackingPosition(delivery, delivery.driver?.companyId === delivery.companyId ? delivery.driver : null, onlineThresholdSeconds, now, target);
    // Frais, estimé ou dernier connu : le livreur reste sur la carte tant que la mission est suivie.
    const driverLocation: DispatchMapDriverLocation | null =
      !isHistorical && position.latitude != null && position.longitude != null && position.updatedAt
        ? {
            latitude: position.latitude,
            longitude: position.longitude,
            updatedAt: position.updatedAt,
            isOnline: position.state === "FRESH",
            estimated: position.estimated,
            motion: position.motion,
          }
        : null;

    const trackingSteps: DispatchMapTrackingStep[] = delivery.trackingEvents.map((e) => ({
      id: e.id,
      label: e.label,
      description: e.description,
      latitude: options?.exposeTrackingCoordinates === false || isLegacyFakeTrackingCoord(e.latitude, e.longitude) ? null : e.latitude,
      longitude: options?.exposeTrackingCoordinates === false || isLegacyFakeTrackingCoord(e.latitude, e.longitude) ? null : e.longitude,
      occurredAt: e.occurredAt.toISOString(),
    }));

    const orderItems: DispatchMapOrderItem[] = delivery.order.items.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
    }));

    result.push({
      id: delivery.id,
      reference: delivery.reference,
      orderId: delivery.order.id,
      requestedDeliveryDate: delivery.order.requestedDeliveryDate?.toISOString() ?? null,
      status: delivery.status,
      statusLabel: statusLabel(delivery.status, delivery.deliveryCategory),
      deliveryCategory: delivery.deliveryCategory,
      driverId: delivery.driverId,
      driverName,
      customerName,
      driverLocation,
      positionState: position.state,
      positionUpdatedAt: position.updatedAt,
      address: destAddress,
      pickupAddress,
      destination: destCoords ? { latitude: destCoords.lat, longitude: destCoords.lng } : null,
      pickup: pickupCoords
        ? { latitude: pickupCoords.lat, longitude: pickupCoords.lng }
        : null,
      pickups,
      trackingSteps,
      orderItems,
      missionStartedAt: delivery.missionStartedAt?.toISOString() ?? null,
      missionAcceptedAt: delivery.missionAcceptedAt?.toISOString() ?? null,
      isHistorical,
      completedAt: delivery.completedAt?.toISOString() ?? null,
      createdAt: delivery.createdAt.toISOString(),
    });

    const typeLabel = delivery.deliveryCategory === "COURIER" ? "Course" : "Commande";
    if (destCoords) points.push({
      id: `${delivery.id}-dest`,
      deliveryId: delivery.id,
      kind: "destination",
      latitude: destCoords.lat,
      longitude: destCoords.lng,
      reference: delivery.reference,
      status: delivery.status,
      deliveryCategory: delivery.deliveryCategory,
      driverName,
      address: destAddress,
      label: `${typeLabel} ${delivery.reference} — ${statusLabel(delivery.status, delivery.deliveryCategory)}`,
    });

    for (const pickupPoint of pickups) {
      points.push({
        id: `${delivery.id}-pickup-${pickupPoint.id}`,
        deliveryId: delivery.id,
        kind: "pickup",
        latitude: pickupPoint.latitude,
        longitude: pickupPoint.longitude,
        reference: delivery.reference,
        status: delivery.status,
        deliveryCategory: delivery.deliveryCategory,
        driverName,
        address: pickupPoint.address,
        label: `${pickupPoint.label} ${delivery.reference}`,
      });
    }

    if (driverLocation && delivery.driverId && driverName) {
      points.push({
        id: `${delivery.id}-driver`,
        deliveryId: delivery.id,
        kind: "driver",
        latitude: driverLocation.latitude,
        longitude: driverLocation.longitude,
        reference: delivery.reference,
        status: delivery.status,
        deliveryCategory: delivery.deliveryCategory,
        driverName,
        address: driverLocation.estimated
          ? "Position estimée du livreur"
          : driverLocation.isOnline
            ? "Position livreur"
            : "Dernière position livreur",
        label: delivery.missionStartedAt
          ? `${driverName} — en mission`
          : `${driverName} — dernière position`,
      });
    }
  }

  return { deliveries: result, points };
}

export async function getDispatchMapDeliveries(
  companyId: string,
  onlineThresholdSeconds = DEFAULT_DRIVER_LOCATION_SETTINGS.onlineThresholdSeconds
): Promise<{ deliveries: DispatchMapDelivery[]; points: DispatchMapPoint[] }> {
  const deliveries = await fetchActiveMapDeliveries({ companyId });
  return buildDeliveriesMapPayload(deliveries, onlineThresholdSeconds);
}

export async function getClientDeliveriesMap(
  customerId: string,
  companyId: string,
  onlineThresholdSeconds = DEFAULT_DRIVER_LOCATION_SETTINGS.onlineThresholdSeconds
): Promise<{ active: DispatchMapDelivery[]; history: DispatchMapDelivery[] }> {
  const [activeRecords, historyRecords] = await Promise.all([
    fetchActiveMapDeliveries({ customerId, companyId }),
    findManyMapDeliveries({
      where: {
        customerId,
        companyId,
        status: { in: MAP_HISTORY_STATUSES },
      },
      orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }],
      take: CLIENT_MAP_HISTORY_LIMIT,
    }),
  ]);

  const [activePayload, historyPayload] = await Promise.all([
    buildDeliveriesMapPayload(activeRecords, onlineThresholdSeconds, { isHistorical: false, exposeTrackingCoordinates: false }),
    buildDeliveriesMapPayload(historyRecords, onlineThresholdSeconds, { isHistorical: true, exposeTrackingCoordinates: false }),
  ]);

  return {
    active: activePayload.deliveries,
    history: historyPayload.deliveries,
  };
}

export async function getDispatchDriversMap(
  companyId: string
): Promise<{ drivers: DispatchDriverMapEntry[]; points: DispatchMapPoint[] }> {
  const drivers = await prisma.user.findMany({
    where: { companyId, status: "ACTIVE", role: { systemRole: "DRIVER" } },
    select: { id: true, firstName: true, lastName: true },
    orderBy: { firstName: "asc" },
  });

  if (drivers.length === 0) return { drivers: [], points: [] };

  const locationSettings = await getCompanyLocationSettings(companyId);
  const locations = await getCompanyDriverLocations(companyId, locationSettings.onlineThresholdSeconds);
  const driverIds = drivers.map((d) => d.id);
  type DriverMapDelivery = {
    id: string;
    reference: string;
    status: DeliveryStatus;
    deliveryCategory: DeliveryCategory;
    address: string;
    city: string | null;
    postalCode: string | null;
    latitude: number | null;
    longitude: number | null;
    driverId: string | null;
    driverName: string | null;
  };

  const driverMapSelectWithCoords = {
    id: true,
    reference: true,
    status: true,
    deliveryCategory: true,
    address: true,
    city: true,
    postalCode: true,
    latitude: true,
    longitude: true,
    driverId: true,
    driverName: true,
  } as const;

  const driverMapSelectLegacy = {
    id: true,
    reference: true,
    status: true,
    deliveryCategory: true,
    address: true,
    city: true,
    postalCode: true,
    driverId: true,
    driverName: true,
  } as const;

  let deliveries: DriverMapDelivery[];
  if (!preferLegacyMapSelect) {
    try {
      deliveries = await prisma.delivery.findMany({
        where: {
          companyId,
          driverId: { in: driverIds },
          status: { in: ["ASSIGNED", "PURCHASING", "IN_DELIVERY"] },
        },
        select: driverMapSelectWithCoords,
      });
    } catch (error) {
      if (!isMissingColumnError(error)) throw error;
      preferLegacyMapSelect = true;
      console.warn(
        "[dispatch-map] Delivery coordinate columns missing on drivers map; falling back to geocode path"
      );
      const legacyRows = await prisma.delivery.findMany({
        where: {
          companyId,
          driverId: { in: driverIds },
          status: { in: ["ASSIGNED", "PURCHASING", "IN_DELIVERY"] },
        },
        select: driverMapSelectLegacy,
      });
      deliveries = legacyRows.map((row) => ({
        ...row,
        latitude: null,
        longitude: null,
      }));
    }
  } else {
    const legacyRows = await prisma.delivery.findMany({
      where: {
        companyId,
        driverId: { in: driverIds },
        status: { in: ["ASSIGNED", "PURCHASING", "IN_DELIVERY"] },
      },
      select: driverMapSelectLegacy,
    });
    deliveries = legacyRows.map((row) => ({
      ...row,
      latitude: null,
      longitude: null,
    }));
  }

  const byDriver = new Map<string, DriverMapDelivery[]>();
  for (const id of driverIds) byDriver.set(id, []);
  for (const d of deliveries) {
    if (!d.driverId) continue;
    byDriver.get(d.driverId)?.push(d);
  }

  const missingGeocode = deliveries.filter(
    (delivery) => delivery.latitude == null || delivery.longitude == null
  );
  const coordsByKey =
    missingGeocode.length > 0
      ? await geocodeManyCapped(
          missingGeocode.map((delivery) => ({
            key: delivery.id,
            parts: {
              address: delivery.address,
              postalCode: delivery.postalCode,
              city: delivery.city,
            },
          }))
        )
      : new Map<string, { lat: number; lng: number }>();

  if (coordsByKey.size > 0 && !preferLegacyMapSelect) {
    void Promise.all(
      missingGeocode.map((delivery) => {
        const coords = coordsByKey.get(delivery.id);
        if (!coords) return Promise.resolve();
        return prisma.delivery.update({
          where: { id: delivery.id },
          data: { latitude: coords.lat, longitude: coords.lng },
        });
      })
    ).catch((error) => {
      if (isMissingColumnError(error)) {
        preferLegacyMapSelect = true;
        console.warn(
          "[dispatch-map] Coordinate columns missing while persisting driver-map coords"
        );
        return;
      }
      console.warn("[dispatch-map] Failed to persist driver-map coordinates", error);
    });
  }

  const entries: DispatchDriverMapEntry[] = [];
  const points: DispatchMapPoint[] = [];

  for (const driver of drivers) {
    const missions = byDriver.get(driver.id) ?? [];
    const missionPoints = missions.map((m) => {
      const coords =
        m.latitude != null && m.longitude != null
          ? { lat: m.latitude, lng: m.longitude }
          : coordsByKey.get(m.id);
      const address = formatAddress([m.address, m.postalCode, m.city]);
      return {
        deliveryId: m.id,
        reference: m.reference,
        status: m.status,
        statusLabel: statusLabel(m.status, m.deliveryCategory),
        deliveryCategory: m.deliveryCategory,
        address,
        latitude: coords?.lat ?? null,
        longitude: coords?.lng ?? null,
      };
    });

    const assigned = missions.filter((m) => m.status === "ASSIGNED").length;
    const inTransit = missions.filter(
      (m) => m.status === "PURCHASING" || m.status === "IN_DELIVERY"
    ).length;

    const location = locations.find(row => row.id === driver.id);

    const name = formatDriverDisplayName(`${driver.firstName} ${driver.lastName}`.trim());

    entries.push({
      id: driver.id,
      name,
      latitude: location?.latitude ?? null,
      longitude: location?.longitude ?? null,
      updatedAt: location?.updatedAt ?? null,
      positionState: location?.positionState ?? "ABSENT",
      estimated: location?.estimated ?? false,
      assigned,
      inTransit,
      missions: missionPoints,
    });

    if (location?.latitude != null && location.longitude != null) points.push({
      id: `driver-${driver.id}`,
      deliveryId: driver.id,
      kind: "driver",
      latitude: location!.latitude!,
      longitude: location!.longitude!,
      reference: name,
      status: inTransit > 0 ? "IN_DELIVERY" : "ASSIGNED",
      deliveryCategory: "STANDARD",
      driverName: name,
      address: `${assigned + inTransit} mission(s) active(s)`,
      label: `${name} — ${assigned} assignée(s), ${inTransit} en cours`,
    });

    for (const mission of missionPoints) {
      if (mission.latitude == null || mission.longitude == null) continue;
      points.push({
        id: `mission-${mission.deliveryId}`,
        deliveryId: mission.deliveryId,
        kind: "destination",
        latitude: mission.latitude,
        longitude: mission.longitude,
        reference: mission.reference,
        status: mission.status,
        deliveryCategory: mission.deliveryCategory,
        driverName: name,
        address: mission.address,
        label: `${mission.reference} (${name})`,
      });
    }
  }

  return { drivers: entries, points };
}
