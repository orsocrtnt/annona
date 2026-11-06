import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { BillingInvoice } from "../src/domains/billing/billing-core";
import { reconcileRevenue } from "../src/domains/billing/revenue-reconciliation";
import { loadBilling } from "./helpers/billing-loader";

const october = { startsAt: new Date("2026-10-01T00:00:00.000Z"), endsAt: new Date("2026-11-01T00:00:00.000Z") };

function invoice(id: string, patch: Partial<BillingInvoice> = {}): BillingInvoice {
  return {
    id, subscriptionId: "sub_a", status: "paid", currency: "EUR",
    subtotalCents: 7900, taxCents: 1580, totalCents: 9480, paidCents: 9480, refundedCents: 0,
    periodStart: "2026-10-01T00:00:00.000Z", periodEnd: "2026-11-01T00:00:00.000Z",
    dueAt: "2026-10-05T00:00:00.000Z", paidAt: "2026-10-05T00:00:10.000Z",
    reason: "subscription_cycle", taxSource: "stripe:test", documentUrl: null,
    ...patch,
  };
}

test("SAAS-02 : journal identique au fournisseur, revenu encaissé à la date d'encaissement et local à l'échéance", () => {
  const cycle = invoice("in_cycle");
  const usage = invoice("in_usage", { reason: "usage", subtotalCents: 1000, taxCents: 200, totalCents: 1200, paidCents: 1200 });
  // Échue fin septembre, encaissée le 1er octobre : comptée en octobre côté fournisseur seulement.
  const late = invoice("in_late", { dueAt: "2026-09-30T23:00:00.000Z", paidAt: "2026-10-01T08:00:00.000Z" });
  const open = invoice("in_open", { status: "open", paidCents: 0, paidAt: null });
  const result = reconcileRevenue([{ accountId: "account-a", local: [cycle, usage, late, open], provider: [cycle, usage, late, open] }], october);

  assert.equal(result.reconciled, true);
  assert.deepEqual(result.discrepancies, []);
  assert.deepEqual(
    { subscription: result.provider.subscriptionHtCents, usage: result.provider.usageHtCents, paid: result.provider.paidInvoices },
    { subscription: 7900 * 2, usage: 1000, paid: 3 }
  );
  assert.deepEqual(result.local, { subscriptionHtCents: 7900, usageHtCents: 1000, paidInvoices: 2 });
});

test("SAAS-02 : chaque écart du journal est nommé, facture par facture, sans masquer les autres comptes", () => {
  const result = reconcileRevenue([
    {
      accountId: "account-a",
      local: [invoice("in_status", { status: "open", paidCents: 0 }), invoice("in_amount", { subtotalCents: 7000, totalCents: 8580, paidCents: 8580 }), invoice("in_refund"), invoice("in_ghost"), { id: "in_corrupt" }],
      provider: [invoice("in_status"), invoice("in_amount"), invoice("in_refund", { refundedCents: 4740 }), invoice("in_new")],
    },
    { accountId: "account-b", local: [invoice("in_ok_b")], provider: [invoice("in_ok_b")] },
  ], october);

  assert.equal(result.reconciled, false);
  assert.deepEqual(result.discrepancies.map(({ invoiceId, kind }) => `${invoiceId}:${kind}`), [
    "in_amount:AMOUNT",
    "in_ghost:UNKNOWN_AT_PROVIDER",
    "in_new:MISSING_LOCALLY",
    "in_refund:REFUND",
    "in_status:STATUS",
  ]);
  assert.ok(result.discrepancies.every((entry) => entry.accountId === "account-a"));
  // Remboursement de moitié : 4 740 TTC, soit 3 950 HT en ventilation proportionnelle.
  assert.equal(result.provider.refundedTtcCents, 4740);
  assert.equal(result.provider.refundedHtCents, 3950);
});

test("SAAS-02 : factures hors mois, non EUR, partielles, sans date d'encaissement ou de motif inconnu exclues du revenu", () => {
  const provider = [
    invoice("in_sept", { dueAt: "2026-09-05T00:00:00.000Z", paidAt: "2026-09-05T00:00:00.000Z" }),
    invoice("in_usd", { currency: "USD" as "EUR" }),
    invoice("in_partial", { paidCents: 100 }),
    invoice("in_undated", { paidAt: undefined }),
    invoice("in_manual", { reason: "manual" }),
    invoice("in_november", { paidAt: "2026-11-01T00:00:00.000Z" }),
  ];
  const result = reconcileRevenue([{ accountId: "account-a", local: provider, provider }], october, 1);
  assert.deepEqual(
    { subscription: result.provider.subscriptionHtCents, paid: result.provider.paidInvoices, undated: result.provider.paidWithoutDate, unknown: result.provider.unknownReasons },
    { subscription: 0, paid: 0, undated: 1, unknown: 1 }
  );
  assert.equal(result.discrepancies.length, 0);
  assert.equal(result.unreadAccounts, 1);
  assert.equal(result.reconciled, false, "un compte illisible chez le fournisseur empêche toute conclusion");
});

test("SAAS-02 : la date d'encaissement Stripe est relue, et le script reste en lecture seule", async () => {
  const { stripe } = loadBilling();
  const env: NodeJS.ProcessEnv = { NODE_ENV: "test", SIGNUP_PAYMENT_ADAPTER: "stripe-sandbox", STRIPE_SECRET_KEY: "sk_test_unit_only", STRIPE_WEBHOOK_SECRET: "whsec_unit_only" };
  const from = 1793145600, to = 1795824000;
  const raw = (patch: Record<string, unknown>) => ({ id: "in_x", livemode: false, currency: "eur", subscription: "sub_test", customer: "cus_test", metadata: {}, charge: null, status: "paid", total: 9480, total_excluding_tax: 7900, amount_paid: 9480, created: from, billing_reason: "subscription_cycle", period_start: from, period_end: from, hosted_invoice_url: null, lines: { data: [{ type: "subscription", proration: false, period: { start: from, end: to } }] }, ...patch });
  let invoices = [raw({ status_transitions: { paid_at: from + 60 } })];
  const provider = new stripe.StripeSandboxProvider((async (url: string | URL) => {
    const path = new URL(String(url)).pathname;
    if (path.endsWith("sub_test")) return Response.json({ id: "sub_test", livemode: false, customer: "cus_test", metadata: { annona_account: "account" }, status: "active", current_period_start: from, current_period_end: to, cancel_at_period_end: false, pending_update: null, items: { data: [] } });
    return Response.json({ data: invoices, has_more: false });
  }) as typeof fetch, env);
  assert.equal((await provider.snapshot("sub_test", "account")).invoices[0]?.paidAt, new Date((from + 60) * 1000).toISOString());
  invoices = [raw({ status: "open", amount_paid: 0, status_transitions: { paid_at: null } })];
  assert.equal((await provider.snapshot("sub_test", "account")).invoices[0]?.paidAt, null);

  const script = readFileSync(resolve("scripts/saas02/reconcile.ts"), "utf8");
  assert.doesNotMatch(script, /\.(create|update|upsert|delete|createMany|updateMany|deleteMany)\(|\$executeRaw|\.(change|cancel|refund|usage|checkout|schedule|paymentPortal)\(/);
  assert.match(script, /provider\.snapshot\(/);
});
