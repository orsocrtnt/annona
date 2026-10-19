import { getDriverMissionById } from "@/domains/delivery/delivery.service";
import { geocodeAddress, formatAddressQuery, isLegacyFakeTrackingCoord } from "@/lib/geocoding";
import { getCourierPickupStops } from "@/lib/order/courier-pickups";
import { isValidCoordinate } from "@/lib/maps/provider-config";
import type { DeliveryCategory, DeliveryStatus } from "@prisma/client";

export type DriverNavigationPoint = {
  latitude: number;
  longitude: number;
  address: string;
  label: string;
};

export type DriverMissionNavigation = {
  id: string;
  reference: string;
  status: DeliveryStatus;
  deliveryCategory: DeliveryCategory;
  missionStartedAt: string | null;
  pickup: DriverNavigationPoint | null;
  pickups: DriverNavigationPoint[];
  destination: DriverNavigationPoint | null;
  target: DriverNavigationPoint | null;
  canNavigate: boolean;
  unavailableReason: string | null;
  destinationQuery: string;
  targetQuery: string | null;
};

function formatAddress(parts: (string | null | undefined)[]) {
  return parts.filter(Boolean).join(", ");
}

function resolveNavigationTarget(
  mission: {
    status: DeliveryStatus;
    deliveryCategory: DeliveryCategory;
    missionStartedAt: Date | null;
  },
  pickup: DriverNavigationPoint | null,
  destination: DriverNavigationPoint | null
): { target: DriverNavigationPoint | null; canNavigate: boolean; unavailableReason: string | null } {
  if (!mission.missionStartedAt) {
    return {
      target: null,
      canNavigate: false,
      unavailableReason: "Démarrez la mission avant de lancer la navigation.",
    };
  }

  if ((mission.deliveryCategory === "COURIER" && mission.status === "ASSIGNED" && !pickup) ||
      (!(mission.deliveryCategory === "COURIER" && mission.status === "ASSIGNED") && !destination)) {
    return { target: null, canNavigate: false, unavailableReason: "Adresse non localisée : navigation indisponible. Réessayez plus tard ou ouvrez l’adresse dans une application externe." };
  }

  if (mission.deliveryCategory === "COURIER") {
    if (mission.status === "ASSIGNED" && pickup) {
      return { target: pickup, canNavigate: true, unavailableReason: null };
    }
    if (mission.status === "PURCHASING" || mission.status === "IN_DELIVERY") {
      return { target: destination, canNavigate: true, unavailableReason: null };
    }
    return {
      target: null,
      canNavigate: false,
      unavailableReason: "Navigation disponible une fois la mission démarrée.",
    };
  }

  if (mission.status === "IN_DELIVERY") {
    return { target: destination, canNavigate: true, unavailableReason: null };
  }

  if (mission.status === "ASSIGNED" || mission.status === "PURCHASING") {
    return {
      target: null,
      canNavigate: false,
      unavailableReason: "Passez en livraison pour lancer la navigation vers le client.",
    };
  }

  return {
    target: null,
    canNavigate: false,
    unavailableReason: "Navigation indisponible pour cette étape.",
  };
}

export async function getDriverMissionNavigation(
  driverId: string,
  companyId: string,
  deliveryId: string
) {
  const mission = await getDriverMissionById(driverId, companyId, deliveryId);
  if (!mission) return null;

  const destinationAddress = formatAddress([
    mission.address,
    mission.postalCode,
    mission.city,
  ]);

  const pickupStops = getCourierPickupStops({
    deliveryCategory: mission.deliveryCategory,
    stops: mission.order.stops,
    pickupAddress: mission.pickupAddress,
    pickupCity: mission.pickupCity,
    pickupPostalCode: mission.pickupPostalCode,
    pickupInstructions: null,
  });

  const [destinationCoords, ...pickupCoordsList] = await Promise.all([
    (isValidCoordinate(mission.latitude, mission.longitude) && !isLegacyFakeTrackingCoord(mission.latitude, mission.longitude)
      ? Promise.resolve({ lat: mission.latitude!, lng: mission.longitude! })
      : geocodeAddress({
      address: mission.address,
      postalCode: mission.postalCode,
      city: mission.city,
    })),
    ...pickupStops.map((stop, index) => {
      const stored = mission.order.stops.find(s => s.address === stop.address && s.city === stop.city && s.postalCode === stop.postalCode);
      const lat = stored?.latitude ?? (index === 0 ? mission.pickupLatitude : null);
      const lng = stored?.longitude ?? (index === 0 ? mission.pickupLongitude : null);
      return isValidCoordinate(lat, lng) && !isLegacyFakeTrackingCoord(lat, lng)
        ? Promise.resolve({ lat: lat!, lng: lng! })
        : geocodeAddress({ address: stop.address, postalCode: stop.postalCode, city: stop.city });
    }),
  ]);

  const destination: DriverNavigationPoint | null = destinationCoords ? {
    latitude: destinationCoords.lat,
    longitude: destinationCoords.lng,
    address: destinationAddress,
    label: "Livraison",
  } : null;

  const pickups: DriverNavigationPoint[] = pickupStops
    .map((stop, index) => {
      const coords = pickupCoordsList[index];
      if (!coords) return null;
      return {
        latitude: coords.lat,
        longitude: coords.lng,
        address: formatAddress([stop.address, stop.postalCode, stop.city]),
        label: stop.label?.trim() || (pickupStops.length > 1 ? `Collecte ${index + 1}` : "Collecte"),
      };
    })
    .filter((point): point is DriverNavigationPoint => point != null);

  const pickup = pickupCoordsList[0] ? pickups[0] ?? null : null;

  const { target, canNavigate, unavailableReason } = resolveNavigationTarget(
    mission,
    pickup,
    destination
  );

  return {
    id: mission.id,
    reference: mission.reference,
    status: mission.status,
    deliveryCategory: mission.deliveryCategory,
    missionStartedAt: mission.missionStartedAt?.toISOString() ?? null,
    pickup,
    pickups,
    destination,
    target,
    canNavigate,
    unavailableReason,
    destinationQuery: formatAddressQuery({
      address: mission.address,
      postalCode: mission.postalCode,
      city: mission.city,
    }),
    targetQuery: target
      ? formatAddressQuery({
          address: target.address,
          postalCode: null,
          city: null,
        })
      : null,
  } satisfies DriverMissionNavigation & {
    destinationQuery: string;
    targetQuery: string | null;
  };
}
