import type { InvoiceStatus } from "@prisma/client";

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: "Brouillon",
  PENDING: "En attente",
  PAID: "Payée",
  OVERDUE: "En retard",
  CANCELLED: "Annulée",
};
