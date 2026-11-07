import type { BillingPeriod, InvoiceStatus, PaymentMethod } from "@prisma/client";
import type { InvoiceLegalGap } from "@/domains/invoice/invoice-legal";
import type { SettlementStatus } from "@/domains/invoice/invoice-settlement";

/** FACT-1 — vues des factures renvoyées par les API (montants en centimes, dates ISO ou « AAAA-MM-JJ »). */

export type InvoiceEmailState = "PENDING" | "SENT" | "NOT_CONFIGURED" | "NO_RECIPIENT" | "FAILED";

export interface InvoiceEmailStatus {
  state: InvoiceEmailState;
  attempt: number;
  at: string;
  recipient: string | null;
}

export interface InvoiceListItem {
  id: string;
  reference: string;
  number: number;
  merchant: { id: string; name: string };
  periodType: BillingPeriod;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  issuedAt: string;
  dueDate: string | null;
  subtotalCents: number;
  vatCents: number;
  totalCents: number;
  paidCents: number;
  remainingCents: number;
  /** Statut enregistré, le retard calculé à la lecture (heure de Paris). */
  status: InvoiceStatus;
  settlement: SettlementStatus;
  daysOverdue: number;
}

export interface AdminInvoiceList {
  invoices: InvoiceListItem[];
  merchants: Array<{ id: string; name: string; billingPeriod: BillingPeriod }>;
  totals: { totalCents: number; paidCents: number; remainingCents: number };
  /** Mentions légales obligatoires absentes des réglages de l'entreprise (ENF-05). */
  legalGaps: InvoiceLegalGap[];
  /** La liste a été tronquée à la limite d'affichage. */
  truncated: boolean;
}

export interface InvoiceDetailLine {
  label: string;
  unit: string | null;
  quantity: number;
  unitPriceCents: number;
  vatRateBasisPoints: number;
  totalCents: number;
}

export interface InvoicePaymentView {
  id: string;
  amountCents: number;
  method: PaymentMethod;
  paidAt: string;
  reference: string | null;
  recordedBy: string | null;
}

export interface AdminInvoiceDetail extends InvoiceListItem {
  merchant: InvoiceListItem["merchant"] & { address: string; billingEmail: string | null };
  lines: InvoiceDetailLine[];
  vatBreakdown: Array<{ vatRateBasisPoints: number; baseCents: number; vatCents: number }>;
  orders: Array<{ id: string; reference: string; deliveryDate: string; subtotalCents: number; shortage: boolean }>;
  payments: InvoicePaymentView[];
  legalGaps: InvoiceLegalGap[];
  email: InvoiceEmailStatus | null;
  emailConfigured: boolean;
  canRemind: boolean;
}

export interface PortalInvoiceList {
  period: { type: BillingPeriod; start: string; end: string; label: string };
  merchantPeriodicity: BillingPeriod;
  invoices: InvoiceListItem[];
  totals: { totalCents: number; paidCents: number; remainingCents: number };
}

export interface GenerationResultView {
  period: { type: BillingPeriod; start: string; end: string; label: string; closed: boolean };
  created: Array<{ id: string; reference: string; merchantName: string; totalCents: number; orderCount: number }>;
  nothingToBill: number;
  skipped: Array<{ merchantName: string; reference: string; reason: string }>;
}
