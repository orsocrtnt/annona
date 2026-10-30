import { parisInstant } from "@/domains/order-intake/order-intake.deadline";
import { deliverySlotKey, type CompanyDeliverySlots, type DeliverySlot } from "@/lib/validations/delivery-slots";

export type DeliverySlotError = "DELIVERY_SLOT_REQUIRED" | "DELIVERY_SLOT_INVALID" | "DELIVERY_SLOT_PAST";

export const DELIVERY_SLOT_ERROR_MESSAGES: Record<DeliverySlotError, string> = {
  DELIVERY_SLOT_REQUIRED: "Choisissez un créneau de livraison",
  DELIVERY_SLOT_INVALID: "Ce créneau n'est plus proposé. Choisissez-en un autre.",
  DELIVERY_SLOT_PAST: "Ce créneau est déjà passé. Choisissez-en un autre.",
};

/** Créneau encore réservable : il se termine dans le futur. */
export function isDeliverySlotOpen(date: string, slot: DeliverySlot, now: Date): boolean {
  const end = parisInstant(date, slot.end);
  return Boolean(end && end > now);
}

export type ResolvedDeliverySlot =
  | { ok: true; requestedDeliveryDate?: string; deliverySlotStart?: string }
  | { ok: false; error: DeliverySlotError };

/**
 * DEMO-3, tranche 7. En mode créneaux, le serveur recalcule début et fin à partir du réglage de
 * l'entreprise (heure de Paris) : aucune heure envoyée par le navigateur n'est crue. La fin du
 * créneau devient la date demandée, qui porte déjà la règle de retard.
 */
export function resolveDeliverySlot(
  settings: CompanyDeliverySlots,
  input: { deliveryCategory: string; requestedDeliveryDate?: string; requestedDeliverySlot?: string },
  now: Date
): ResolvedDeliverySlot {
  if (settings.mode !== "SLOTS" || input.deliveryCategory === "SPECIAL_MISSION") {
    return { ok: true, requestedDeliveryDate: input.requestedDeliveryDate };
  }
  if (!input.requestedDeliveryDate || !input.requestedDeliverySlot) return { ok: false, error: "DELIVERY_SLOT_REQUIRED" };
  const date = input.requestedDeliveryDate.slice(0, 10);
  const slot = settings.slots.find((candidate) => deliverySlotKey(candidate) === input.requestedDeliverySlot);
  const start = slot && parisInstant(date, slot.start);
  const end = slot && parisInstant(date, slot.end);
  if (!start || !end) return { ok: false, error: "DELIVERY_SLOT_INVALID" };
  if (end <= now) return { ok: false, error: "DELIVERY_SLOT_PAST" };
  return { ok: true, requestedDeliveryDate: end.toISOString(), deliverySlotStart: start.toISOString() };
}
