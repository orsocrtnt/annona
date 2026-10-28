import type { BillingInvoice } from "./billing-core";

/**
 * Rapprochement du revenu SaaS : journal local (`SaasBillingAccount.state.invoices`) contre
 * factures relues chez le fournisseur. Fonction pure, sans lecture ni écriture.
 *
 * Le revenu « encaissé » du mois retient la date d'encaissement fournisseur (`paidAt`) ; le
 * revenu local de la santé SaaS retient l'échéance (`dueAt`). Les deux sont présentés côte à côte.
 */
const SUBSCRIPTION_REASONS = new Set(["subscription_create", "subscription_cycle", "subscription_update"]);
const USAGE_REASONS = new Set(["usage", "subscription_usage"]);

export type RevenueDiscrepancyKind = "MISSING_LOCALLY" | "UNKNOWN_AT_PROVIDER" | "STATUS" | "AMOUNT" | "REFUND";
export type RevenueDiscrepancy = { accountId: string; invoiceId: string; kind: RevenueDiscrepancyKind };
export type RevenueAccountInput = { accountId: string; local: unknown[]; provider: BillingInvoice[] };
type Totals = { subscriptionHtCents: number; usageHtCents: number; paidInvoices: number };

export type RevenueReconciliation = {
  period: { startsAt: string; endsAt: string };
  accounts: number;
  unreadAccounts: number;
  /** Encaissé chez le fournisseur dans le mois, HT, à la date d'encaissement. */
  provider: Totals & {
    paidWithoutDate: number;
    unknownReasons: number;
    refundedTtcCents: number;
    /** Ventilation proportionnelle au HT de chaque facture : provisoire, sans validation comptable. */
    refundedHtCents: number;
  };
  /** Indicateur local de la santé SaaS, à la date d'échéance. */
  local: Totals;
  discrepancies: RevenueDiscrepancy[];
  reconciled: boolean;
};

type LocalInvoice = Pick<BillingInvoice, "id" | "status" | "subtotalCents" | "taxCents" | "totalCents" | "paidCents" | "refundedCents" | "dueAt" | "reason" | "currency">;

function localInvoice(value: unknown): LocalInvoice | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const invoice = value as Record<string, unknown>;
  const integer = (field: string) => (Number.isSafeInteger(invoice[field]) ? (invoice[field] as number) : null);
  if (typeof invoice.id !== "string" || !invoice.id || typeof invoice.status !== "string") return null;
  const amounts = ["subtotalCents", "taxCents", "totalCents", "paidCents", "refundedCents"].map(integer);
  if (amounts.some((amount) => amount === null)) return null;
  const [subtotalCents, taxCents, totalCents, paidCents, refundedCents] = amounts as number[];
  return {
    id: invoice.id,
    status: invoice.status as BillingInvoice["status"],
    subtotalCents: subtotalCents!,
    taxCents: taxCents!,
    totalCents: totalCents!,
    paidCents: paidCents!,
    refundedCents: refundedCents!,
    dueAt: typeof invoice.dueAt === "string" ? invoice.dueAt : "",
    reason: typeof invoice.reason === "string" ? invoice.reason : "",
    currency: invoice.currency as "EUR",
  };
}

const fullyPaid = (invoice: LocalInvoice) =>
  invoice.status === "paid" && invoice.currency === "EUR" && invoice.paidCents === invoice.totalCents;

function inPeriod(value: string | null | undefined, period: { startsAt: Date; endsAt: Date }) {
  const at = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(at) && at >= period.startsAt.getTime() && at < period.endsAt.getTime();
}

function add(totals: Totals, invoice: LocalInvoice) {
  if (SUBSCRIPTION_REASONS.has(invoice.reason)) totals.subscriptionHtCents += invoice.subtotalCents;
  else if (USAGE_REASONS.has(invoice.reason)) totals.usageHtCents += invoice.subtotalCents;
  else return false;
  totals.paidInvoices++;
  return true;
}

export function reconcileRevenue(
  accounts: RevenueAccountInput[],
  period: { startsAt: Date; endsAt: Date },
  unreadAccounts = 0
): RevenueReconciliation {
  const provider = {
    subscriptionHtCents: 0, usageHtCents: 0, paidInvoices: 0,
    paidWithoutDate: 0, unknownReasons: 0, refundedTtcCents: 0, refundedHtCents: 0,
  };
  const local: Totals = { subscriptionHtCents: 0, usageHtCents: 0, paidInvoices: 0 };
  const discrepancies: RevenueDiscrepancy[] = [];

  for (const account of accounts) {
    const localById = new Map<string, LocalInvoice>();
    for (const raw of account.local) {
      const invoice = localInvoice(raw);
      if (invoice) localById.set(invoice.id, invoice);
    }
    const providerById = new Map(account.provider.map((invoice) => [invoice.id, invoice]));

    for (const invoice of providerById.values()) {
      const known = localById.get(invoice.id);
      const issue = (kind: RevenueDiscrepancyKind) => discrepancies.push({ accountId: account.accountId, invoiceId: invoice.id, kind });
      if (!known) issue("MISSING_LOCALLY");
      else if (known.status !== invoice.status) issue("STATUS");
      else if (known.subtotalCents !== invoice.subtotalCents || known.taxCents !== invoice.taxCents ||
        known.totalCents !== invoice.totalCents || known.paidCents !== invoice.paidCents) issue("AMOUNT");
      else if (known.refundedCents !== invoice.refundedCents) issue("REFUND");

      if (!fullyPaid(invoice)) continue;
      if (!invoice.paidAt) { provider.paidWithoutDate++; continue; }
      if (!inPeriod(invoice.paidAt, period)) continue;
      if (!add(provider, invoice)) { provider.unknownReasons++; continue; }
      provider.refundedTtcCents += invoice.refundedCents;
      if (invoice.totalCents > 0) provider.refundedHtCents += Math.round((invoice.refundedCents * invoice.subtotalCents) / invoice.totalCents);
    }

    for (const invoice of localById.values()) {
      if (!providerById.has(invoice.id)) {
        discrepancies.push({ accountId: account.accountId, invoiceId: invoice.id, kind: "UNKNOWN_AT_PROVIDER" });
      }
      if (fullyPaid(invoice) && inPeriod(invoice.dueAt, period)) add(local, invoice);
    }
  }

  discrepancies.sort((a, b) => a.accountId.localeCompare(b.accountId) || a.invoiceId.localeCompare(b.invoiceId));
  return {
    period: { startsAt: period.startsAt.toISOString(), endsAt: period.endsAt.toISOString() },
    accounts: accounts.length,
    unreadAccounts,
    provider,
    local,
    discrepancies,
    reconciled: discrepancies.length === 0 && unreadAccounts === 0,
  };
}
