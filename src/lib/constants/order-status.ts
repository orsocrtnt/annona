import type { OrderStatus, OrderOrigin, PaymentMethod, BillingPeriod, RoundStatus, StopStatus } from "@prisma/client";

/** Libellés français centralisés (ENF-07) des statuts du nouveau modèle. */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  DRAFT: "Brouillon",
  VALIDATED: "Validée",
  LOCKED: "Verrouillée",
  PREPARED: "Préparée",
  DELIVERED: "Livrée",
  CANCELLED: "Annulée",
};

export const ORDER_ORIGIN_LABELS: Record<OrderOrigin, string> = {
  MANUAL: "Manuelle",
  RECURRING: "Récurrente",
};

export const ROUND_STATUS_LABELS: Record<RoundStatus, string> = {
  DRAFT: "Calculée",
  ASSIGNED: "Attribuée",
  IN_PROGRESS: "En cours",
  COMPLETED: "Terminée",
  CANCELLED: "Annulée",
};

export const STOP_STATUS_LABELS: Record<StopStatus, string> = {
  PENDING: "À livrer",
  DELIVERED: "Livré",
  INCIDENT: "Incident",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  VIREMENT: "Virement",
  PRELEVEMENT: "Prélèvement",
  ESPECES: "Espèces",
};

export const BILLING_PERIOD_LABELS: Record<BillingPeriod, string> = {
  DAILY: "Jour",
  WEEKLY: "Semaine",
  MONTHLY: "Mois",
  YEARLY: "Année",
};
