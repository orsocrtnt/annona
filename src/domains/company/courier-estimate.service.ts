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
  /** Prix hors taxes : la ligne de la facture. */
  amount: number | null;
  /** Prix à payer, TVA comprise : ce que voit le client, et le total de sa facture. */
  total: number | null;
  distanceKm: number | null;
}

/** Même arrondi que la ligne de TVA de la facture : le total annoncé égale le total facturé. */
export function courierTotalWithVat(amount: number, vatRate: number) {
  return Math.round((amount + Math.round(amount * vatRate) / 100) * 100) / 100;
}

/**
 * Estimation indicative du prix d'une course pour le client.
 * Renvoie `enabled: false` si l'admin n'a pas activé l'affichage de l'estimation.
 */
export async function estimateCourierPrice(
  companyId: string,
  input: CourierEstimateInput
): Promise<CourierEstimateResult> {
  const { courier, invoice } = await getCompanyBillingSettings(companyId);

  if (!courier.showClientEstimate) {
    return { enabled: false, amount: null, total: null, distanceKm: null };
  }
  if (!input.pickup.address || !input.shipping.address) {
    return { enabled: true, amount: null, total: null, distanceKm: null };
  }

  const [from, to] = await Promise.all([
    geocodeAddress(input.pickup),
    geocodeAddress(input.shipping),
  ]);

  if (!from || !to) return { enabled: true, amount: null, total: null, distanceKm: null };

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

  const amount = Math.round(price * 100) / 100;
  return { enabled: true, amount, total: courierTotalWithVat(amount, invoice.vatRate), distanceKm };
}

/**
 * Ligne de facture d'une course : le prix annoncé au client, si l'entreprise affiche l'estimation
 * (FACT-KM). Sans estimation affichée ou sans distance calculable, la facture reste sur les zones.
 */
export async function announcedCourierLine(
  companyId: string,
  order: {
    deliveryCategory: string;
    pickupAddress: string | null;
    pickupCity: string | null;
    pickupPostalCode: string | null;
    shippingAddress: string | null;
    shippingCity: string | null;
    shippingPostalCode: string | null;
    requestedDeliveryDate: Date | null;
  },
  estimate: typeof estimateCourierPrice = estimateCourierPrice
): Promise<{ label: string; amount: number } | null> {
  if (order.deliveryCategory !== "COURIER" || !order.pickupAddress || !order.shippingAddress) return null;
  const announced = await estimate(companyId, {
    pickup: { address: order.pickupAddress, city: order.pickupCity, postalCode: order.pickupPostalCode },
    shipping: { address: order.shippingAddress, city: order.shippingCity, postalCode: order.shippingPostalCode },
    requestedDeliveryDate: order.requestedDeliveryDate?.toISOString() ?? null,
  });
  if (!announced.enabled || announced.amount == null || announced.distanceKm == null) return null;
  return { label: `Course, environ ${announced.distanceKm} km`, amount: announced.amount };
}
