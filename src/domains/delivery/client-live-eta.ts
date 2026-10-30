import { estimateTravelTimes, type GeoPoint, type TravelTimeOptions } from "@/lib/dispatch/travel-time";
import type { ClientLiveEta } from "@/lib/format/live-eta";

/** Un appel au service de trajet par destination : plafonné à chaque lecture de la carte client. */
export const MAX_ETA_NETWORK_CALLS = 3;

export type LiveEtaDelivery = {
  id: string;
  status: string;
  deliveryCategory: string;
  destination: GeoPoint | null;
  driverLocation: (GeoPoint & { isOnline: boolean; estimated: boolean }) | null;
};

/** Même règle que `trackingTarget` : le livreur se dirige vers le client, pas vers un retrait. */
function isHeadingToCustomer(delivery: LiveEtaDelivery) {
  return delivery.status === "IN_DELIVERY" || (delivery.deliveryCategory === "COURIER" && delivery.status === "PURCHASING");
}

/**
 * DEMO-3, tranche 4 — « arrive dans X min » du portail client. Sans position exploitable, aucune
 * estimation : le portail garde l'heure planifiée. Seules les minutes sortent, jamais de coordonnée.
 */
export async function attachClientLiveEta<T extends LiveEtaDelivery>(
  deliveries: T[],
  options: Omit<TravelTimeOptions, "allowNetwork"> = {}
): Promise<Array<T & { liveEta: ClientLiveEta | null }>> {
  let networkCalls = 0;
  const result: Array<T & { liveEta: ClientLiveEta | null }> = [];
  for (const delivery of deliveries) {
    const { driverLocation, destination } = delivery;
    const usable = driverLocation && destination && isHeadingToCustomer(delivery) && (driverLocation.isOnline || driverLocation.estimated);
    if (!usable) {
      result.push({ ...delivery, liveEta: null });
      continue;
    }
    const { estimates, networkCalls: used } = await estimateTravelTimes(
      [{ id: delivery.id, point: { latitude: driverLocation.latitude, longitude: driverLocation.longitude } }],
      destination,
      { ...options, allowNetwork: networkCalls < MAX_ETA_NETWORK_CALLS }
    );
    networkCalls += used;
    const estimate = estimates.get(delivery.id);
    result.push({
      ...delivery,
      liveEta: estimate ? { minutes: Math.max(1, Math.ceil(estimate.seconds / 60)), approximate: estimate.source !== "ROUTE" } : null,
    });
  }
  return result;
}
