import type { DeliveryCategory, DeliveryStatus, OrderStatus } from "@prisma/client";

export const FULFILLMENT_STATUS_LABELS: Record<OrderStatus, string> = {
  QUOTE_REQUESTED: "Devis demandé",
  PENDING: "En attente",
  ASSIGNED: "Assigné",
  PURCHASING: "En cours d'achat",
  IN_DELIVERY: "En livraison",
  DELIVERED: "Livré",
  INVOICED: "Facturé",
  PAID: "Payé",
  CANCELLED: "Annulé",
  FAILED: "Échec de livraison",
};

/** Libellés courts pour les selects en tableau */
export const COMPACT_STATUS_LABELS: Record<OrderStatus, string> = {
  QUOTE_REQUESTED: "Devis",
  PENDING: "Attente",
  ASSIGNED: "Assigné",
  PURCHASING: "Achats",
  IN_DELIVERY: "En cours",
  DELIVERED: "Livré",
  INVOICED: "Facturé",
  PAID: "Payé",
  CANCELLED: "Annulé",
  FAILED: "Échec",
};

/** Tous les statuts modifiables par l'administrateur */
export const ADMIN_EDITABLE_STATUSES: OrderStatus[] = [
  "QUOTE_REQUESTED",
  "PENDING",
  "ASSIGNED",
  "PURCHASING",
  "IN_DELIVERY",
  "DELIVERED",
  "CANCELLED",
  "FAILED",
];

const SPECIAL_MISSION_QUOTE_STATUSES: OrderStatus[] = [
  "QUOTE_REQUESTED",
  "PENDING",
  "CANCELLED",
];

/**
 * Une demande de mission spéciale n'est pas encore une livraison. Tant que
 * l'accord a lieu hors TutelLiv, l'administration peut seulement la conserver,
 * la convertir manuellement après accord ou l'annuler.
 */
export function getAdminEditableOrderStatuses(
  currentStatus: OrderStatus,
  deliveryCategory?: DeliveryCategory | null
): OrderStatus[] {
  if (
    currentStatus === "QUOTE_REQUESTED" &&
    deliveryCategory === "SPECIAL_MISSION"
  ) {
    return SPECIAL_MISSION_QUOTE_STATUSES;
  }
  return ADMIN_EDITABLE_STATUSES.filter(
    (status) =>
      status !== "ASSIGNED" &&
      (status === currentStatus || isTeamStatusChangeAllowed(currentStatus, status))
  );
}

/**
 * Changements d'état permis à l'équipe (AUDIT-0111, C1). Une commande avance et ne recule pas ;
 * annulée ou payée, elle n'en bouge plus. Seul un échec peut repartir en attente, pour replanifier.
 * « Assigné » passe par l'affectation, et retirer un livreur par son action dédiée.
 */
const TEAM_STATUS_CHANGES: Record<OrderStatus, OrderStatus[]> = {
  QUOTE_REQUESTED: ["PENDING", "CANCELLED"],
  PENDING: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["PURCHASING", "IN_DELIVERY", "DELIVERED", "FAILED", "CANCELLED"],
  PURCHASING: ["IN_DELIVERY", "DELIVERED", "FAILED", "CANCELLED"],
  IN_DELIVERY: ["DELIVERED", "FAILED", "CANCELLED"],
  DELIVERED: ["INVOICED", "PAID"],
  INVOICED: ["PAID"],
  PAID: [],
  CANCELLED: [],
  FAILED: ["PENDING"],
};

export function isTeamStatusChangeAllowed(from: OrderStatus, to: OrderStatus) {
  return TEAM_STATUS_CHANGES[from].includes(to);
}

/** Statuts modifiables par le livreur */
export const DRIVER_EDITABLE_STATUSES: OrderStatus[] = [
  "ASSIGNED",
  "PURCHASING",
  "IN_DELIVERY",
  "DELIVERED",
  "FAILED",
];

export const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  "QUOTE_REQUESTED",
  "PENDING",
  "ASSIGNED",
  "PURCHASING",
  "IN_DELIVERY",
];

export const HISTORY_ORDER_STATUSES: OrderStatus[] = [
  "DELIVERED",
  "INVOICED",
  "PAID",
  "CANCELLED",
  "FAILED",
];

export const DRIVER_ACTIVE_STATUSES: OrderStatus[] = [
  "ASSIGNED",
  "PURCHASING",
  "IN_DELIVERY",
  "DELIVERED",
  "FAILED",
];

export const TERMINAL_STATUSES: OrderStatus[] = ["PAID", "CANCELLED", "FAILED"];

export function getFulfillmentStatusLabel(
  status: OrderStatus | DeliveryStatus,
  deliveryCategory?: DeliveryCategory | null
): string {
  if (status === "QUOTE_REQUESTED") {
    return deliveryCategory === "SPECIAL_MISSION" ? "Devis demandé" : "Devis demandé";
  }
  if (status === "PURCHASING" && deliveryCategory === "COURIER") {
    return "Collecté";
  }
  return FULFILLMENT_STATUS_LABELS[status as OrderStatus];
}

export function getCompactStatusLabel(
  status: OrderStatus | DeliveryStatus,
  deliveryCategory?: DeliveryCategory | null
): string {
  if (status === "QUOTE_REQUESTED") {
    return "Devis";
  }
  if (status === "PURCHASING" && deliveryCategory === "COURIER") {
    return "Collecté";
  }
  return COMPACT_STATUS_LABELS[status as OrderStatus];
}
