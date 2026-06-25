import { getCompanyBillingSettings } from "./billing-settings.service";
import { geocodeAddress, type AddressParts } from "@/lib/geocoding";

const EARTH_RADIUS_KM = 6371;
/** Facteur route appliqué à la distance à vol d'oiseau (estimation indicative). */
const ROAD_FACTOR = 1.3;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export interface CourierEstimateInput {
  pickup: AddressParts;
  shipping: AddressParts;
  requestedDeliveryDate?: string | null;
}

export interface CourierEstimateResult {
  enabled: boolean;
  amount: number | null;
  distanceKm: number | null;
}

/**
 * Estimation indicative du prix d'une course pour le client.
 * Renvoie `enabled: false` si l'admin n'a pas activé l'affichage de l'estimation.
 */
export async function estimateCourierPrice(
  companyId: string,
  input: CourierEstimateInput
): Promise<CourierEstimateResult> {
  const { courier } = await getCompanyBillingSettings(companyId);

  if (!courier.showClientEstimate) {
    return { enabled: false, amount: null, distanceKm: null };
  }
  if (!input.pickup.address || !input.shipping.address) {
    return { enabled: true, amount: null, distanceKm: null };
  }

  const [from, to] = await Promise.all([
    geocodeAddress(input.pickup),
    geocodeAddress(input.shipping),
  ]);

  const distanceKm = Math.round(haversineKm(from, to) * ROAD_FACTOR * 10) / 10;

  let price = courier.basePrice + Math.max(0, distanceKm - courier.freeKmIncluded) * courier.pricePerKm;
  price = Math.max(price, courier.minimumPrice);

  if (input.requestedDeliveryDate) {
    const date = new Date(input.requestedDeliveryDate);
    if (!Number.isNaN(date.getTime())) {
      const day = date.getDay();
      const hour = date.getHours();
      let multiplier = 1;
      if (day === 0 || day === 6) multiplier += courier.weekendSurchargePercent / 100;
      if (hour >= 20 || hour < 7) multiplier += courier.nightSurchargePercent / 100;
      price *= multiplier;
    }
  }

  return {
    enabled: true,
    amount: Math.round(price * 100) / 100,
    distanceKm,
  };
}
