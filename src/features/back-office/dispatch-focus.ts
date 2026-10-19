import type { DeliveryStatus } from "@prisma/client";

const ACTIVE_DELIVERY_STATUSES = new Set<DeliveryStatus>([
  "PENDING",
  "ASSIGNED",
  "PURCHASING",
  "IN_DELIVERY",
]);

export type DispatchFocusableDelivery = {
  id: string;
  status: DeliveryStatus;
  completedAt?: string | null;
  order: {
    requestedDeliveryDate?: string | null;
  };
};

export type DispatchFocus =
  | { state: "none" }
  | {
      state: "ready";
      delivery: DispatchFocusableDelivery;
      reason: "late" | "delivery";
    }
  | { state: "unavailable"; reason: "late" | "delivery" };

export function buildDispatchTargetHref(deliveryId: string, late = false) {
  const params = new URLSearchParams({ delivery: deliveryId });
  if (late) params.set("focus", "late");
  return `/dispatch?${params.toString()}`;
}

export function isLateDispatchDelivery(
  delivery: DispatchFocusableDelivery,
  now = new Date()
) {
  const deadline = delivery.order.requestedDeliveryDate;
  if (!deadline || delivery.completedAt || !ACTIVE_DELIVERY_STATUSES.has(delivery.status)) {
    return false;
  }

  const deadlineAt = new Date(deadline);
  return !Number.isNaN(deadlineAt.getTime()) && deadlineAt.getTime() < now.getTime();
}

export function resolveDispatchFocus(
  params: Pick<URLSearchParams, "get">,
  deliveries: DispatchFocusableDelivery[],
  now = new Date()
): DispatchFocus {
  const deliveryId = params.get("delivery")?.trim();
  if (!deliveryId) return { state: "none" };

  const reason = params.get("focus") === "late" ? "late" : "delivery";
  const delivery = deliveries.find((candidate) => candidate.id === deliveryId);

  if (!delivery || (reason === "late" && !isLateDispatchDelivery(delivery, now))) {
    return { state: "unavailable", reason };
  }

  return { state: "ready", delivery, reason };
}
