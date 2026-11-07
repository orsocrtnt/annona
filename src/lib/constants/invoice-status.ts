import type { BillingPeriod, InvoiceStatus, PaymentMethod } from "@prisma/client";
import type { SettlementStatus } from "@/domains/invoice/invoice-settlement";

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: "Brouillon",
  PENDING: "En attente",
  PAID: "Payée",
  OVERDUE: "En retard",
  CANCELLED: "Annulée",
};

/** FACT-1 (RG-07) : statut de règlement calculé. */
export const SETTLEMENT_LABELS: Record<SettlementStatus, string> = {
  TO_PAY: "À régler",
  PARTIAL: "Partiellement réglée",
  PAID: "Réglée",
};

/** Modes de règlement saisis par l'administrateur (RG-07). */
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  VIREMENT: "Virement",
  PRELEVEMENT: "Prélèvement",
  ESPECES: "Espèces",
};

/** Périodicité de facturation d'un client (ADM-10, CLI-10). */
export const BILLING_PERIOD_LABELS: Record<BillingPeriod, string> = {
  DAILY: "Journalière",
  WEEKLY: "Hebdomadaire",
  MONTHLY: "Mensuelle",
  YEARLY: "Annuelle",
};
