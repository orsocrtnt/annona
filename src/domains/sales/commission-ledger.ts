import {
  addUtcMonths,
  calculateTheoreticalCommission,
  commissionEntryKey,
  type SalesAttributionSnapshot,
  type SalesSettlement,
} from "./commission-core";

/**
 * SALES-1, décisions du 27 octobre 2026 : écritures théoriques par facture d'abonnement.
 * - les factures sont ventilées selon les lignes figées à l'inscription ; une facture qui ne
 *   correspond plus exactement au contrat initial est écartée avec un motif ;
 * - un remboursement reprend la commission au prorata, par écriture négative ;
 * - la fenêtre de douze mois part de la période de la première facture.
 */
export type CommissionInvoice = {
  id: string;
  status: "draft" | "open" | "paid" | "void" | "uncollectible";
  reason: string;
  currency: "EUR";
  subtotalCents: number;
  totalCents: number;
  paidCents: number;
  refundedCents: number;
  periodStart: string;
};

export type CommissionExplanation =
  | "ELIGIBLE"
  | "NOT_PAID"
  | "OUTSIDE_WINDOW"
  | "LATER_CHANGE_OR_USAGE"
  | "CONTRACT_CHANGED"
  | "PARTIAL_PAYMENT"
  | "UNRECOGNISED_INVOICE"
  | "REFUND";

export type CommissionEntry = {
  id: string;
  settlementKey: string;
  explanation: CommissionExplanation;
  eligibleHtCents: number;
  rateBps: number;
  commissionCents: number;
  receivedAt: Date;
};

const REASONS: Record<string, SalesSettlement["reason"]> = {
  subscription_create: "subscription_create",
  subscription_cycle: "subscription_cycle",
  subscription_update: "subscription_update",
  usage: "subscription_usage",
};

const STATUS: Record<Exclude<CommissionInvoice["status"], "draft">, SalesSettlement["status"]> = {
  open: "OPEN",
  paid: "PAID",
  void: "VOID",
  uncollectible: "UNCOLLECTIBLE",
};

function entry(
  attribution: SalesAttributionSnapshot,
  settlementKey: string,
  explanation: CommissionExplanation,
  receivedAt: Date,
  eligibleHtCents = 0,
  commissionCents = 0
): CommissionEntry {
  return {
    id: commissionEntryKey(attribution, settlementKey),
    settlementKey,
    explanation,
    eligibleHtCents,
    rateBps: attribution.rateBps,
    commissionCents,
    receivedAt,
  };
}

/** Écritures manquantes pour ces factures ; `existing` rend le calcul idempotent et cumulatif. */
export function commissionEntriesForInvoices(
  attribution: SalesAttributionSnapshot,
  invoices: CommissionInvoice[],
  existing: Array<{ settlementKey: string; commissionCents: number }>
): CommissionEntry[] {
  const initial = invoices.find((invoice) => invoice.reason === "subscription_create" && invoice.status === "paid");
  if (!initial) return [];
  const windowEnd = addUtcMonths(new Date(initial.periodStart), 12).getTime();
  const initialHtCents = attribution.eligibleLines.reduce((sum, line) => sum + line.quantity * line.unitHtCents, 0);
  const known = new Set(existing.map((row) => row.settlementKey));
  const entries: CommissionEntry[] = [];

  for (const invoice of invoices) {
    if (invoice.status === "draft") continue;
    const receivedAt = new Date(invoice.periodStart);
    const settlementKey = `${invoice.id}:${invoice.status}`;
    let paid: CommissionEntry;
    const reason = REASONS[invoice.reason];
    if (!reason) {
      paid = entry(attribution, settlementKey, "UNRECOGNISED_INVOICE", receivedAt);
    } else if (invoice.status !== "paid") {
      paid = entry(attribution, settlementKey, "NOT_PAID", receivedAt);
    } else if (invoice.paidCents !== invoice.totalCents) {
      paid = entry(attribution, settlementKey, "PARTIAL_PAYMENT", receivedAt);
    } else if (receivedAt.getTime() >= windowEnd) {
      paid = entry(attribution, settlementKey, "OUTSIDE_WINDOW", receivedAt);
    } else if ((reason === "subscription_create" || reason === "subscription_cycle") && invoice.subtotalCents !== initialHtCents) {
      paid = entry(attribution, settlementKey, "CONTRACT_CHANGED", receivedAt);
    } else {
      const initialLines = reason === "subscription_create" || reason === "subscription_cycle";
      const settlement: SalesSettlement = {
        key: settlementKey,
        // La fenêtre est déjà vérifiée sur la période ; le noyau reçoit la date d'attribution.
        receivedAt: new Date(attribution.attributedAt),
        status: STATUS[invoice.status],
        reason,
        currency: invoice.currency,
        paidHtCents: invoice.subtotalCents,
        lines: initialLines
          ? attribution.eligibleLines.map((line) => ({ code: line.code, paidHtCents: line.quantity * line.unitHtCents }))
          : [{ code: `invoice:${invoice.reason}`, paidHtCents: invoice.subtotalCents }],
      };
      const result = calculateTheoreticalCommission(attribution, settlement);
      paid = entry(attribution, settlementKey, result.explanation, receivedAt, result.eligibleHtCents, result.commissionCents);
    }
    if (!known.has(settlementKey)) entries.push(paid);

    // Reprise au prorata du montant remboursé, arrondie au centime supérieur et plafonnée.
    if (invoice.status !== "paid" || paid.commissionCents <= 0 || invoice.refundedCents <= 0 || invoice.paidCents <= 0) continue;
    const refunded = Math.min(invoice.refundedCents, invoice.paidCents);
    const target = Math.min(paid.commissionCents, Math.ceil((paid.commissionCents * refunded) / invoice.paidCents));
    const prefix = `${invoice.id}:refund:`;
    const reversed = -existing
      .filter((row) => row.settlementKey.startsWith(prefix))
      .reduce((sum, row) => sum + row.commissionCents, 0);
    const refundKey = `${prefix}${refunded}`;
    if (target > reversed && !known.has(refundKey)) {
      entries.push(entry(attribution, refundKey, "REFUND", receivedAt, 0, -(target - reversed)));
    }
  }
  return entries;
}
