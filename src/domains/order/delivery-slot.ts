import { parisInstant } from "@/domains/order-intake/order-intake.deadline";
import { WHOLE_DAY_DUE_TIME } from "@/lib/orders/whole-day-due";
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

/**
 * Une date seule (« au jour ») vaut jusqu'à la fin de la journée à Paris. Lue telle quelle, elle
 * tomberait à minuit UTC, soit 01:00 à Paris : la commande serait en retard dès sa création.
 */
export function requestedDeliveryInstant(value: string): Date {
  return (/^\d{4}-\d{2}-\d{2}$/.test(value) ? parisInstant(value, WHOLE_DAY_DUE_TIME) : null) ?? new Date(value);
}

/** Commande récurrente : le créneau choisi doit exister tant que l'entreprise est en mode créneaux. */
export function deliverySlotChoiceError(settings: CompanyDeliverySlots, key: string | null | undefined): DeliverySlotError | null {
  if (settings.mode !== "SLOTS") return null;
  if (!key) return "DELIVERY_SLOT_REQUIRED";
  return settings.slots.some((slot) => deliverySlotKey(slot) === key) ? null : "DELIVERY_SLOT_INVALID";
}

/**
 * Occurrence d'une récurrence : une commande n'est jamais perdue. Créneau supprimé ou entreprise
 * repassée au jour : l'occurrence part « au jour ». Un rattrapage garde son créneau, même passé,
 * pour que la relance d'une occurrence interrompue reste identique (clé d'idempotence).
 */
export function recurringOccurrenceDelivery(settings: CompanyDeliverySlots, input: { deliveryCategory: string; date: string; key: string | null }) {
  const resolved = input.key
    ? resolveDeliverySlot(settings, { deliveryCategory: input.deliveryCategory, requestedDeliveryDate: input.date, requestedDeliverySlot: input.key }, new Date(0))
    : null;
  return resolved?.ok && resolved.deliverySlotStart
    ? { requestedDeliveryDate: resolved.requestedDeliveryDate!, deliverySlotStart: resolved.deliverySlotStart }
    : { requestedDeliveryDate: input.date };
}

/** Message IA : créneau qui contient l'heure trouvée, sinon le premier qui finit après elle. */
export function suggestDeliverySlot(slots: DeliverySlot[], time: string | null | undefined): DeliverySlot | null {
  if (!time) return null;
  return slots.find((slot) => slot.start <= time && time <= slot.end) ?? slots.find((slot) => slot.end >= time) ?? null;
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
