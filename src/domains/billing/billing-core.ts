import { createHash } from "node:crypto";
import type { SignupCatalog, SignupOptionSelection, SignupQuote } from "@/domains/signup/signup.service";
import { buildSignupQuote } from "@/domains/signup/signup.service";

export const MAX_BILLING_CENTS = 99_999_999;
export type BillingContract = {
  hash: string;
  quote: SignupQuote;
  catalog: SignupCatalog;
  lines: Array<{ code: string; name: string; quantity: number; unitHtCents: number }>;
};
export function cents(value: number) {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_BILLING_CENTS) throw new Error("BILLING_AMOUNT_INVALID");
  return value;
}
export function makeBillingContract(catalog: SignupCatalog, plan: SignupQuote["planCode"], interval: SignupQuote["billingInterval"], selections: SignupOptionSelection[]): BillingContract {
  if (catalog.currency !== "EUR" || !Number.isInteger(catalog.vatRateBps) || catalog.vatRateBps < 0 || catalog.vatRateBps > 10_000) throw new Error("BILLING_TAX_INVALID");
  const chosen = catalog.plans.find((p) => p.code === plan);
  if (plan === "BUSINESS" && (chosen?.unlimitedDriverSeats || chosen?.includedDriverSeats !== 20 || chosen?.maxDriverSeats !== 50)) throw new Error("BILLING_BUSINESS_CATALOG_STALE");
  for (const option of catalog.options) {
    if (option.annualPriceCents !== option.monthlyPriceCents * 12) throw new Error("BILLING_ANNUAL_OPTION_INVALID");
  }
  const quote = buildSignupQuote(catalog, plan, interval, [...selections].sort((a, b) => a.code.localeCompare(b.code)));
  cents(quote.totalHtCents); cents(quote.vatCents); cents(quote.totalTtcCents);
  if (quote.totalTtcCents < 50) throw new Error("BILLING_AMOUNT_INVALID");
  const lines = [{ code: `plan:${plan}`, name: quote.planName, quantity: 1, unitHtCents: quote.planPriceCents }, ...quote.selections.map((s) => {
    const o = catalog.options.find((candidate) => candidate.code === s.code)!;
    return { code: o.code, name: o.name, quantity: s.quantity, unitHtCents: interval === "ANNUAL" ? o.annualPriceCents : o.monthlyPriceCents };
  })];
  const hash = createHash("sha256").update(JSON.stringify({ quote, lines })).digest("hex");
  return { hash, quote, catalog, lines };
}
export type BillingInvoice = {
  id: string; subscriptionId: string; status: "draft" | "open" | "paid" | "void" | "uncollectible";
  currency: "EUR"; subtotalCents: number; taxCents: number; totalCents: number; paidCents: number;
  refundedCents: number; periodStart: string; periodEnd: string; dueAt: string;
  reason: string; taxSource: string; documentUrl: string | null;
};
export type ProviderSnapshot = {
  subscriptionId: string; customerId: string; live: false; status: string;
  contractHash: string | null; periodStart: string; periodEnd: string; cancelAtPeriodEnd: boolean;
  pendingUpdate: boolean; invoices: BillingInvoice[];
};
export type BillingState = {
  schemaVersion: 1; contract: BillingContract; activeContract: BillingContract | null;
  status: "PENDING_PAYMENT" | "ACTIVE" | "PAST_DUE" | "RESTRICTED" | "READ_ONLY" | "CANCELLED";
  periodStart: string | null; periodEnd: string | null; failedAt: string | null;
  cancelAtPeriodEnd: boolean; invoices: BillingInvoice[]; reconciledAt: string | null;
  pendingChange: { contract: BillingContract; invoiceId: string | null; atRenewal: boolean; expectedTotalCents?: number } | null;
};
export function initialBillingState(contract: BillingContract): BillingState {
  return { schemaVersion: 1, contract, activeContract: null, status: "PENDING_PAYMENT", periodStart: null, periodEnd: null, failedAt: null, cancelAtPeriodEnd: false, invoices: [], reconciledAt: null, pendingChange: null };
}
export function overdueStatus(failedAt: string | null, now: Date): BillingState["status"] {
  if (!failedAt) return "ACTIVE";
  const days = (now.getTime() - Date.parse(failedAt)) / 86_400_000;
  return days >= 30 ? "READ_ONLY" : days >= 14 ? "RESTRICTED" : "PAST_DUE";
}
export function reminderDays(failedAt: string, now: Date) {
  const days = Math.floor((now.getTime() - Date.parse(failedAt)) / 86_400_000);
  return [0, 3, 7, 14, 30].filter((day) => day <= days);
}
export function validateInvoice(invoice: BillingInvoice) {
  if (invoice.currency !== "EUR") throw new Error("BILLING_CURRENCY_MISMATCH");
  [invoice.subtotalCents, invoice.taxCents, invoice.totalCents, invoice.paidCents, invoice.refundedCents].forEach(cents);
  if (invoice.totalCents !== invoice.subtotalCents + invoice.taxCents || invoice.paidCents > invoice.totalCents || invoice.refundedCents > invoice.paidCents || !invoice.taxSource) throw new Error("BILLING_INVOICE_MISMATCH");
  if (!(Date.parse(invoice.periodStart) < Date.parse(invoice.periodEnd)) || !Number.isFinite(Date.parse(invoice.dueAt))) throw new Error("BILLING_PERIOD_INVALID");
}
/** Provider GET is authoritative; event.created never grants rights or orders state transitions. */
export function reconcileBilling(state: BillingState, snapshot: ProviderSnapshot, now = new Date()): BillingState {
  if (snapshot.live !== false || !snapshot.subscriptionId || !snapshot.customerId) throw new Error("BILLING_SANDBOX_REQUIRED");
  if (!(Date.parse(snapshot.periodStart) < Date.parse(snapshot.periodEnd))) throw new Error("BILLING_PERIOD_INVALID");
  const invoices = new Map(state.invoices.map((i) => [i.id, i]));
  for (const invoice of snapshot.invoices) {
    validateInvoice(invoice);
    if (invoice.subscriptionId !== snapshot.subscriptionId) throw new Error("BILLING_TENANT_MISMATCH");
    const previous = invoices.get(invoice.id);
    if (previous && ((previous.status === "paid" && invoice.status !== "paid") || invoice.refundedCents < previous.refundedCents)) throw new Error("BILLING_STALE_SNAPSHOT");
    invoices.set(invoice.id, invoice);
  }
  const next: BillingState = { ...state, invoices: [...invoices.values()], cancelAtPeriodEnd: snapshot.cancelAtPeriodEnd, reconciledAt: now.toISOString() };
  const paid = next.invoices.filter((i) => i.status === "paid" && i.paidCents === i.totalCents);
  if (!next.activeContract) {
    const initial = paid.find((i) => i.reason === "subscription_create" && i.totalCents === state.contract.quote.totalTtcCents && i.subtotalCents === state.contract.quote.totalHtCents && i.taxCents === state.contract.quote.vatCents);
    if (initial && snapshot.contractHash === state.contract.hash && !snapshot.pendingUpdate && snapshot.status === "active") next.activeContract = state.contract;
  }
  let acceptedChangeInvoice: string | null = null;
  if (next.activeContract && next.pendingChange && !snapshot.pendingUpdate && snapshot.contractHash === next.pendingChange.contract.hash) {
    const change = next.pendingChange;
    const settled = change.atRenewal
      ? paid.some((i) => i.reason === "subscription_cycle" && Date.parse(i.periodStart) <= now.getTime() && Date.parse(i.periodStart) >= Date.parse(state.periodEnd ?? snapshot.periodStart) && i.totalCents === change.contract.quote.totalTtcCents && i.subtotalCents === change.contract.quote.totalHtCents && i.taxCents === change.contract.quote.vatCents)
      : paid.some((i) => i.id === change.invoiceId && i.totalCents === change.expectedTotalCents);
    if (settled) { acceptedChangeInvoice = change.invoiceId; next.activeContract = change.contract; next.contract = change.contract; next.pendingChange = null; }
  }
  if (next.pendingChange && !snapshot.pendingUpdate && next.pendingChange.invoiceId && next.invoices.some((i) => i.id === next.pendingChange!.invoiceId && i.status === "void")) next.pendingChange = null;
  if (!next.activeContract) return next;
  // A usage invoice must not advance the annual entitlement period.
  const renewal = paid.filter((i) => {
    if (i.reason === "subscription_create") return i.totalCents === state.contract.quote.totalTtcCents && i.subtotalCents === state.contract.quote.totalHtCents && i.taxCents === state.contract.quote.vatCents;
    if (snapshot.contractHash !== next.activeContract!.hash || snapshot.pendingUpdate || snapshot.status !== "active" || i.periodEnd !== snapshot.periodEnd) return false;
    if (i.reason === "subscription_update") return i.id === acceptedChangeInvoice;
    return i.reason === "subscription_cycle" && i.totalCents === next.activeContract!.quote.totalTtcCents && i.subtotalCents === next.activeContract!.quote.totalHtCents && i.taxCents === next.activeContract!.quote.vatCents;
  }).sort((a, b) => Date.parse(b.periodEnd) - Date.parse(a.periodEnd))[0];
  if (renewal && (!next.periodEnd || Date.parse(renewal.periodEnd) >= Date.parse(next.periodEnd))) {
    next.periodStart = renewal.periodStart; next.periodEnd = renewal.periodEnd;
  }
  const unpaid = next.invoices.filter((i) => ["open", "uncollectible"].includes(i.status) && i.totalCents > i.paidCents).sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
  next.failedAt = unpaid[0]?.dueAt ?? (next.periodEnd && now.getTime() >= Date.parse(next.periodEnd) ? next.periodEnd : null);
  next.status = overdueStatus(next.failedAt, now);
  if (["canceled", "incomplete_expired"].includes(snapshot.status) || (next.cancelAtPeriodEnd && next.periodEnd && now.getTime() >= Date.parse(next.periodEnd))) next.status = "CANCELLED";
  return next;
}
export function changeTiming(current: BillingContract, target: BillingContract): "immediate" | "renewal" {
  if (current.hash === target.hash) throw new Error("BILLING_CHANGE_EMPTY");
  if (current.quote.billingInterval === "ANNUAL" && target.quote.billingInterval === "MONTHLY") return "renewal";
  const ranks = { STARTER: 0, PRO: 1, BUSINESS: 2 };
  const reduced = ranks[target.quote.planCode] < ranks[current.quote.planCode] || current.lines.some((line) => !line.code.startsWith("plan:") && (target.lines.find((l) => l.code === line.code)?.quantity ?? 0) < line.quantity);
  return reduced ? "renewal" : "immediate";
}
export function monthlyUsageAmount(input: { startsAt: Date; endsAt: Date; closedAt: Date | null; orderCount: number; includedOrders: number; orderOverageUnitPriceCents: number }, now: Date) {
  if (input.endsAt > now || input.startsAt.getUTCDate() !== 1 || input.endsAt.getUTCDate() !== 1 || input.endsAt.getTime() !== Date.UTC(input.startsAt.getUTCFullYear(), input.startsAt.getUTCMonth() + 1, 1)) throw new Error("BILLING_USAGE_PERIOD_OPEN");
  cents(input.orderCount); cents(input.includedOrders); cents(input.orderOverageUnitPriceCents);
  return cents(Math.max(0, input.orderCount - input.includedOrders) * input.orderOverageUnitPriceCents);
}
