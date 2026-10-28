import type { z } from "zod";
import type { createClientOrderSchema } from "@/lib/validations/order";
import type { OrderIntakeDraft } from "./order-intake.draft";
import type { IntakeStop } from "./order-intake.schema";

/** Formulaire éditable du brouillon : une livraison à la fois, comme l'écran de création. */
export interface IntakeFormStop {
  address: string;
  city: string;
  postalCode: string;
  contactName: string;
  phone: string;
  instructions: string;
}

export interface IntakeFormValues {
  deliveryCategory: "COURIER" | "STANDARD";
  pickup: IntakeFormStop;
  delivery: IntakeFormStop;
  /** Jour local à Paris, AAAA-MM-JJ (champ date existant de la commande). */
  requestedDeliveryDate: string;
  /** Échéance lisible recopiée dans les consignes (l'heure n'a pas de colonne dédiée). */
  deadlineLabel: string;
  urgent: boolean;
  packageName: string;
  quantity: number;
  instructions: string;
}

export type IntakeOrderInput = z.input<typeof createClientOrderSchema>;

const EMPTY_STOP: IntakeFormStop = { address: "", city: "", postalCode: "", contactName: "", phone: "", instructions: "" };

function stopValues(stop: IntakeStop | undefined): IntakeFormStop {
  if (!stop) return { ...EMPTY_STOP };
  return {
    address: stop.address.value ?? "",
    city: stop.city.value ?? "",
    postalCode: stop.postalCode.value ?? "",
    contactName: stop.contactName.value ?? "",
    phone: stop.phone.value ?? "",
    instructions: stop.instructions.value ?? "",
  };
}

export function draftToFormValues(draft: OrderIntakeDraft, deliveryIndex: number): IntakeFormValues {
  const deadline = draft.deadline;
  return {
    deliveryCategory: "COURIER",
    pickup: stopValues(draft.pickup),
    delivery: stopValues(draft.deliveries[deliveryIndex]),
    requestedDeliveryDate: deadline.date ?? "",
    deadlineLabel: deadline.time ? (deadline.label ?? "") : "",
    urgent: draft.urgency.value === "urgent",
    packageName: draft.packages.description.value ?? "",
    quantity: draft.packages.quantity.value ?? 1,
    instructions: draft.instructions.value ?? "",
  };
}

const clean = (value: string) => value.trim();
const joinParts = (parts: string[]) => parts.map(clean).filter(Boolean).join(" · ") || undefined;

function contactLine(stop: IntakeFormStop) {
  const name = clean(stop.contactName);
  const phone = clean(stop.phone);
  if (!name && !phone) return "";
  return `Contact : ${[name, phone].filter(Boolean).join(" — ")}`;
}

/**
 * Transforme le formulaire relu en entrée du schéma de création existant. Contacts, échéance et
 * urgence vont dans les consignes, faute de colonnes dédiées. Aucune coordonnée n'est transmise :
 * le géocodage reste celui du service de commande. La source ADMIN est fixée par le serveur.
 */
export function buildOrderInputFromForm(values: IntakeFormValues): IntakeOrderInput {
  const items = [{ name: clean(values.packageName) || "Colis", quantity: Math.max(1, Math.trunc(values.quantity) || 1) }];
  const pickupInstructions = joinParts([values.pickup.instructions, contactLine(values.pickup)]);
  const deliveryInstructions = joinParts([
    values.urgent ? "URGENT" : "",
    values.deadlineLabel ? `Échéance : ${values.deadlineLabel} (heure de Paris)` : "",
    values.delivery.instructions,
    contactLine(values.delivery),
    values.instructions,
  ]);
  const shared = {
    shippingAddress: clean(values.delivery.address),
    shippingCity: clean(values.delivery.city),
    shippingPostalCode: clean(values.delivery.postalCode),
    deliveryInstructions,
    requestedDeliveryDate: clean(values.requestedDeliveryDate),
    notes: "Commande saisie depuis un message reçu (brouillon assisté, relu avant création).",
  };

  if (values.deliveryCategory === "COURIER") {
    return {
      ...shared,
      deliveryCategory: "COURIER",
      items: [],
      pickupStops: [{
        label: "Enlèvement",
        address: clean(values.pickup.address),
        city: clean(values.pickup.city),
        postalCode: clean(values.pickup.postalCode),
        instructions: pickupInstructions,
        items,
      }],
    };
  }
  return {
    ...shared,
    deliveryCategory: "STANDARD",
    items,
    pickupAddress: clean(values.pickup.address) || undefined,
    pickupCity: clean(values.pickup.city) || undefined,
    pickupPostalCode: clean(values.pickup.postalCode) || undefined,
    pickupInstructions,
  };
}
