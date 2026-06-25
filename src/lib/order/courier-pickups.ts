import type { DeliveryCategory } from "@prisma/client";
import type { RouteAddress } from "@/components/shared/delivery-route-display";

type OrderStopLike = {
  sequence?: number;
  label?: string | null;
  address: string;
  city?: string | null;
  postalCode?: string | null;
  instructions?: string | null;
};

export function getCourierPickupStops(
  order: {
    deliveryCategory?: DeliveryCategory | null;
    stops?: OrderStopLike[];
    pickupAddress?: string | null;
    pickupCity?: string | null;
    pickupPostalCode?: string | null;
    pickupInstructions?: string | null;
  }
): RouteAddress[] {
  if (order.deliveryCategory !== "COURIER") return [];

  if (order.stops?.length) {
    return [...order.stops]
      .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
      .map((stop) => ({
        label: stop.label,
        address: stop.address,
        city: stop.city,
        postalCode: stop.postalCode,
        instructions: stop.instructions,
      }));
  }

  if (order.pickupAddress) {
    return [
      {
        label: "Collecte",
        address: order.pickupAddress,
        city: order.pickupCity,
        postalCode: order.pickupPostalCode,
        instructions: order.pickupInstructions,
      },
    ];
  }

  return [];
}

export function getPrimaryCourierPickupFields(
  pickupStops: OrderStopLike[]
): {
  pickupAddress: string | null;
  pickupCity: string | null;
  pickupPostalCode: string | null;
  pickupInstructions: string | null;
} {
  const firstStop = [...pickupStops].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))[0];
  if (!firstStop) {
    return {
      pickupAddress: null,
      pickupCity: null,
      pickupPostalCode: null,
      pickupInstructions: null,
    };
  }

  return {
    pickupAddress: firstStop.address,
    pickupCity: firstStop.city ?? null,
    pickupPostalCode: firstStop.postalCode ?? null,
    pickupInstructions: firstStop.instructions ?? null,
  };
}

export function formatStopAddress(stop: OrderStopLike) {
  return [stop.address, stop.postalCode, stop.city].filter(Boolean).join(", ");
}
