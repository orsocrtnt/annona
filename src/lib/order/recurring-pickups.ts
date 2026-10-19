import type { DeliveryCategory } from "@prisma/client";
import type { RouteAddress } from "@/components/shared/delivery-route-display";
import type { PickupStopInput } from "@/lib/validations/order";

export type StoredPickupStop = PickupStopInput;

export function parseStoredPickupStops(value: unknown): StoredPickupStop[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (stop): stop is StoredPickupStop =>
      typeof stop === "object" &&
      stop != null &&
      "address" in stop &&
      typeof (stop as StoredPickupStop).address === "string"
  );
}

export function resolveRecurringPickupStops(input: {
  deliveryCategory?: DeliveryCategory | null;
  pickupStops?: StoredPickupStop[] | unknown;
  pickupAddress?: string | null;
  pickupCity?: string | null;
  pickupPostalCode?: string | null;
  pickupInstructions?: string | null;
}): StoredPickupStop[] {
  if (input.deliveryCategory !== "COURIER") return [];

  const stored = Array.isArray(input.pickupStops)
    ? input.pickupStops
    : parseStoredPickupStops(input.pickupStops);

  if (stored.length > 0) return stored;

  if (input.pickupAddress) {
    return [
      {
        label: "Collecte 1",
        address: input.pickupAddress,
        city: input.pickupCity ?? "",
        postalCode: input.pickupPostalCode ?? "",
        instructions: input.pickupInstructions ?? undefined,
        items: [],
      },
    ];
  }

  return [];
}

export function firstPickupFields(stops: StoredPickupStop[]) {
  const first = stops[0];
  return {
    pickupAddress: first?.address ?? null,
    pickupCity: first?.city ?? null,
    pickupPostalCode: first?.postalCode ?? null,
    pickupInstructions: first?.instructions ?? null,
  };
}

export function recurringPickupStopsToRoute(stops: StoredPickupStop[]): RouteAddress[] {
  return stops.map((stop, index) => ({
    label: stop.label?.trim() || (stops.length > 1 ? `Collecte ${index + 1}` : "Collecte"),
    address: stop.address,
    city: stop.city,
    postalCode: stop.postalCode,
    instructions: stop.instructions,
  }));
}
