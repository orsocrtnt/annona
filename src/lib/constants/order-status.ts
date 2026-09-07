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
  "INVOICED",
  "PAID",
  "CANCELLED",
  "FAILED",
];

/** Statuts modifiables par le chauffeur */
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
