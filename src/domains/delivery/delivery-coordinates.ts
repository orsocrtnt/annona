import { prisma } from "@/services/prisma/client";
import { geocodeAddress, type AddressParts } from "@/lib/geocoding";

export type DeliveryCoordinateFields = {
  latitude: number | null;
  longitude: number | null;
  pickupLatitude: number | null;
  pickupLongitude: number | null;
};

type DeliveryAddressInput = {
  address?: string | null;
  city?: string | null;
  postalCode?: string | null;
  pickupAddress?: string | null;
  pickupCity?: string | null;
  pickupPostalCode?: string | null;
};

/** Géocode destination (+ pickup optionnel) pour un create/update delivery. */
export async function resolveDeliveryCoordinateFields(
  input: DeliveryAddressInput & { includePickup?: boolean }
): Promise<DeliveryCoordinateFields> {
  const dest = await geocodeAddress({
    address: input.address,
    city: input.city,
    postalCode: input.postalCode,
  });

  const includePickup =
    input.includePickup !== false && Boolean(input.pickupAddress?.trim());

  if (!includePickup) {
    return {
      latitude: dest?.lat ?? null,
      longitude: dest?.lng ?? null,
      pickupLatitude: null,
      pickupLongitude: null,
    };
  }

  const pickup = await geocodeAddress({
    address: input.pickupAddress,
    city: input.pickupCity,
    postalCode: input.pickupPostalCode,
  });

  return {
    latitude: dest?.lat ?? null,
    longitude: dest?.lng ?? null,
    pickupLatitude: pickup?.lat ?? null,
    pickupLongitude: pickup?.lng ?? null,
  };
}

/** Géocode une adresse d'arrêt (OrderStop). */
export async function resolveStopCoordinates(parts: AddressParts): Promise<{
  latitude: number | null;
  longitude: number | null;
}> {
  const coords = await geocodeAddress(parts);
  return { latitude: coords?.lat ?? null, longitude: coords?.lng ?? null };
}

/**
 * Complète et persiste les coordonnées manquantes d'une livraison.
 * Utile en rattrapage (anciennes livraisons) ou après repair.
 */
export async function ensureDeliveryCoordinates(delivery: DeliveryAddressInput & {
  id: string;
  latitude?: number | null;
  longitude?: number | null;
  pickupLatitude?: number | null;
  pickupLongitude?: number | null;
}): Promise<DeliveryCoordinateFields> {
  const needsDest = delivery.latitude == null || delivery.longitude == null;
  const needsPickup =
    Boolean(delivery.pickupAddress?.trim()) &&
    (delivery.pickupLatitude == null || delivery.pickupLongitude == null);

  if (!needsDest && !needsPickup) {
    return {
      latitude: delivery.latitude ?? null,
      longitude: delivery.longitude ?? null,
      pickupLatitude: delivery.pickupLatitude ?? null,
      pickupLongitude: delivery.pickupLongitude ?? null,
    };
  }

  const data: {
    latitude?: number;
    longitude?: number;
    pickupLatitude?: number;
    pickupLongitude?: number;
  } = {};

  if (needsDest) {
    const dest = await geocodeAddress({
      address: delivery.address,
      city: delivery.city,
      postalCode: delivery.postalCode,
    });
    if (dest) { data.latitude = dest.lat; data.longitude = dest.lng; }
  }

  if (needsPickup) {
    const pickup = await geocodeAddress({
      address: delivery.pickupAddress,
      city: delivery.pickupCity,
      postalCode: delivery.pickupPostalCode,
    });
    if (pickup) { data.pickupLatitude = pickup.lat; data.pickupLongitude = pickup.lng; }
  }

  if (Object.keys(data).length) await prisma.delivery.update({
    where: { id: delivery.id },
    data,
  });

  return {
    latitude: data.latitude ?? delivery.latitude ?? null,
    longitude: data.longitude ?? delivery.longitude ?? null,
    pickupLatitude: data.pickupLatitude ?? delivery.pickupLatitude ?? null,
    pickupLongitude: data.pickupLongitude ?? delivery.pickupLongitude ?? null,
  };
}

/** Complète et persiste les coordonnées manquantes d'un arrêt. */
export async function ensureOrderStopCoordinates(stop: AddressParts & {
  id: string;
  latitude?: number | null;
  longitude?: number | null;
}): Promise<{ latitude: number | null; longitude: number | null }> {
  if (stop.latitude != null && stop.longitude != null) {
    return { latitude: stop.latitude, longitude: stop.longitude };
  }

  const coords = await resolveStopCoordinates({
    address: stop.address,
    city: stop.city,
    postalCode: stop.postalCode,
  });

  if (coords.latitude != null && coords.longitude != null) await prisma.orderStop.update({
    where: { id: stop.id },
    data: { latitude: coords.latitude, longitude: coords.longitude },
  });

  return coords;
}
