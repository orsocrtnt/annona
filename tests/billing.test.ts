import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHmac } from "node:crypto";
import type { SignupCatalog } from "../src/domains/signup/signup.service";
import type { BillingInvoice, ProviderSnapshot } from "../src/domains/billing/billing-core";
import { loadBilling } from "./helpers/billing-loader";
const { core, stripe } = loadBilling();
const catalog: SignupCatalog = {
  id: "c9", code: "C9", currency: "EUR", vatRateBps: 2000,
  plans: ["STARTER", "PRO", "BUSINESS"].map((code, i) => ({ code: code as "STARTER" | "PRO" | "BUSINESS", name: code, monthlyPriceCents: [7900, 17900, 34900][i]!, annualPriceCents: [79000, 179000, 349000][i]!, includedDriverSeats: [5, 10, 20][i]!, maxDriverSeats: [10, 30, 50][i]!, unlimitedDriverSeats: false, includedAdminSeats: i === 2 ? 2 : 1, maxAdminSeats: null, includedDispatcherSeats: i ? 1 : 0, maxDispatcherSeats: null, includedMonthlyOrders: [1000, 3000, 6000][i]!, orderOverageUnitPriceCents: [10, 8, 6][i]!, includedFeatures: i ? ["auto_dispatch"] : [] })),
  options: [
    { id: "gps", code: "AUTO", name: "Dispatch", kind: "OPTION", featureKey: "auto_dispatch", monthlyPriceCents: 2900, annualPriceCents: 34800, applicablePlans: ["STARTER", "PRO", "BUSINESS"] },
    { id: "driver", code: "DRIVER_BUSINESS", name: "Livreur", kind: "DRIVER_SEAT", featureKey: null, monthlyPriceCents: 900, annualPriceCents: 10800, applicablePlans: ["BUSINESS"] },
  ],
};
const contract = core.makeBillingContract(catalog, "STARTER", "MONTHLY", []);
const invoice: BillingInvoice = { id: "in_initial", subscriptionId: "sub_test", status: "paid", currency: "EUR", subtotalCents: 7900, taxCents: 1580, totalCents: 9480, paidCents: 9480, refundedCents: 0, periodStart: "2026-01-01T00:00:00.000Z", periodEnd: "2026-02-01T00:00:00.000Z", dueAt: "2026-01-01T00:00:00.000Z", reason: "subscription_create", taxSource: "simulated:2000bps", documentUrl: null };
const snapshot: ProviderSnapshot = { subscriptionId: "sub_test", customerId: "cus_test", live: false, status: "active", contractHash: contract.hash, periodStart: invoice.periodStart, periodEnd: invoice.periodEnd, cancelAtPeriodEnd: false, pendingUpdate: false, invoices: [invoice] };
const now = new Date("2026-01-01T00:00:00Z");
const active = () => core.reconcileBilling(core.initialBillingState(contract), snapshot, now);

test("SAAS-01B : prix annuels, sièges Business 20 à 50, options incluses et limites", () => {
  const annual = core.makeBillingContract(catalog, "STARTER", "ANNUAL", [{ code: "AUTO", quantity: 1 }]);
  assert.equal(annual.quote.totalHtCents, 79000 + 2900 * 12);
  assert.throws(() => core.makeBillingContract(catalog, "PRO", "MONTHLY", [{ code: "AUTO", quantity: 1 }]), /ALREADY_INCLUDED/);
  assert.equal(core.makeBillingContract(catalog, "BUSINESS", "ANNUAL", [{ code: "DRIVER_BUSINESS", quantity: 30 }]).quote.totalHtCents, 349000 + 30 * 10800);
  assert.throws(() => core.makeBillingContract(catalog, "BUSINESS", "MONTHLY", [{ code: "DRIVER_BUSINESS", quantity: 31 }]), /LIMIT_EXCEEDED/);
  assert.throws(() => core.makeBillingContract({ ...catalog, options: [{ ...catalog.options[0]!, annualPriceCents: 29000 }] }, "STARTER", "ANNUAL", []), /ANNUAL_OPTION/);
  for (const amount of [-1, 0.5, Number.MAX_SAFE_INTEGER, NaN, Infinity]) assert.throws(() => core.cents(amount));
});
test("SAAS-01B : TVA simulée 0/5,5/20 et devise EUR tracées", () => {
  for (const rate of [0, 550, 2000]) {
    const result = core.makeBillingContract({ ...catalog, vatRateBps: rate }, "STARTER", "MONTHLY", []);
    assert.equal(result.quote.vatCents, Math.round(7900 * rate / 10000));
    assert.equal(result.quote.totalTtcCents, result.quote.totalHtCents + result.quote.vatCents);
  }
  assert.throws(() => core.makeBillingContract({ ...catalog, currency: "USD" }, "STARTER", "MONTHLY", []));
});
test("SAAS-01B : aucun droit sur retour navigateur, facture ouverte, montant ou contrat différent", () => {
  for (const patch of [{ invoices: [] }, { invoices: [{ ...invoice, status: "open" as const, paidCents: 0 }] }, { contractHash: "forged" }, { pendingUpdate: true }, { status: "incomplete" }, { invoices: [{ ...invoice, subtotalCents: 7901, taxCents: 1579 }] }]) {
    assert.equal(core.reconcileBilling(core.initialBillingState(contract), { ...snapshot, ...patch }, now).activeContract, null);
  }
  assert.equal(active().status, "ACTIVE");
});
test("SAAS-01B : rejeu/ordre inversé ne dupliquent pas paiement ; rapprochement retrouve événement manquant", () => {
  const first = active();
  assert.equal(core.reconcileBilling(first, snapshot, now).invoices.length, 1);
  assert.equal(core.reconcileBilling(core.initialBillingState(contract), snapshot, now).activeContract?.hash, contract.hash);
  assert.throws(() => core.reconcileBilling(first, { ...snapshot, invoices: [{ ...invoice, status: "open", paidCents: 0 }] }, now), /STALE/);
  assert.throws(() => core.reconcileBilling(first, { ...snapshot, invoices: [{ ...invoice, subscriptionId: "other" }] }, now), /TENANT/);
});
test("SAAS-01B : renouvellement, J0/J3/J7/J14/J30 et régularisation", () => {
  const debt = { ...invoice, id: "in_renew", reason: "subscription_cycle", status: "open" as const, paidCents: 0, periodStart: invoice.periodEnd, periodEnd: "2026-03-01T00:00:00.000Z", dueAt: invoice.periodEnd };
  for (const [days, status] of [[0, "PAST_DUE"], [3, "PAST_DUE"], [7, "PAST_DUE"], [14, "RESTRICTED"], [30, "READ_ONLY"]] as const) {
    const result = core.reconcileBilling(active(), { ...snapshot, invoices: [invoice, debt] }, new Date(Date.parse(debt.dueAt) + days * 86400000));
    assert.equal(result.status, status); assert.equal(result.periodEnd, invoice.periodEnd);
  }
  const paid = { ...debt, status: "paid" as const, paidCents: debt.totalCents };
  const result = core.reconcileBilling(active(), { ...snapshot, periodStart: paid.periodStart, periodEnd: paid.periodEnd, invoices: [invoice, paid] }, new Date(debt.dueAt));
  assert.equal(result.status, "ACTIVE"); assert.equal(result.periodEnd, paid.periodEnd);
  assert.deepEqual(JSON.parse(JSON.stringify(core.reminderDays(debt.dueAt, new Date("2026-03-03T00:00:00Z")))), [0, 3, 7, 14, 30]);
});
test("SAAS-01B : montée payée seulement, diminution et annuel→mensuel différés", () => {
  const target = core.makeBillingContract(catalog, "PRO", "MONTHLY", []);
  assert.equal(core.changeTiming(contract, target), "immediate");
  assert.equal(core.changeTiming(target, contract), "renewal");
  assert.equal(core.changeTiming(core.makeBillingContract(catalog, "PRO", "ANNUAL", []), target), "renewal");
  const state = { ...active(), pendingChange: { contract: target, invoiceId: "in_upgrade", atRenewal: false, expectedTotalCents: invoice.totalCents } };
  assert.equal(core.reconcileBilling(state, { ...snapshot, contractHash: target.hash }, now).activeContract?.hash, contract.hash);
  assert.equal(core.reconcileBilling(state, { ...snapshot, contractHash: target.hash, invoices: [invoice, { ...invoice, id: "in_upgrade", reason: "subscription_update" }] }, now).activeContract?.hash, target.hash);
});
test("SAAS-01B : résiliation à échéance et remboursement tracé sans destruction", () => {
  const cancelled = core.reconcileBilling(active(), { ...snapshot, cancelAtPeriodEnd: true }, new Date(invoice.periodEnd));
  assert.equal(cancelled.status, "CANCELLED"); assert.ok(cancelled.activeContract);
  const refunded = core.reconcileBilling(active(), { ...snapshot, invoices: [{ ...invoice, refundedCents: 5000 }] }, now);
  assert.equal(refunded.invoices[0]?.refundedCents, 5000); assert.equal(refunded.status, "ACTIVE");
  assert.throws(() => core.reconcileBilling(refunded, snapshot, now), /STALE/);
  assert.throws(() => core.validateInvoice({ ...invoice, refundedCents: 9481 }));
});
test("SAAS-01B : usage mensuel en annuel, période ouverte refusée et aucun report de droits", () => {
  const period = { startsAt: new Date("2026-01-01Z"), endsAt: new Date("2026-02-01Z"), closedAt: null, orderCount: 1100, includedOrders: 1000, orderOverageUnitPriceCents: 10 };
  assert.equal(core.monthlyUsageAmount(period, new Date("2026-02-01Z")), 1000);
  assert.throws(() => core.monthlyUsageAmount(period, now), /PERIOD_OPEN/);
  const usage = { ...invoice, id: "in_usage", reason: "usage", periodEnd: "2026-04-01T00:00:00Z" };
  assert.equal(core.reconcileBilling(active(), { ...snapshot, invoices: [invoice, usage] }, now).periodEnd, invoice.periodEnd);
});
test("SAAS-01B : signatures brutes, secret faux, corps modifié, tolérance et événement live", () => {
  const secret = "whsec_unit_test_only", timestamp = Math.floor(Date.now() / 1000);
  const raw = JSON.stringify({ id: "evt_test", livemode: false, type: "invoice.paid", data: { object: { id: "in_test" } } });
  const sign = (text: string) => `t=${timestamp},v1=${createHmac("sha256", secret).update(`${timestamp}.${text}`).digest("hex")}`;
  assert.equal(stripe.verifyStripeEvent(raw, sign(raw), secret).id, "evt_test");
  assert.throws(() => stripe.verifyStripeEvent(raw + " ", sign(raw), secret));
  assert.throws(() => stripe.verifyStripeEvent(raw, sign(raw), "whsec_wrong"));
  assert.throws(() => stripe.verifyStripeEvent(raw, sign(raw), secret, (timestamp + 301) * 1000));
  const live = raw.replace('"livemode":false', '"livemode":true');
  assert.throws(() => stripe.verifyStripeEvent(live, sign(live), secret));
  assert.throws(() => stripe.verifyStripeEvent(raw, `t=${timestamp},${sign(raw)}`, secret));
});
test("SAAS-01B : garde test/Production, réseau et secrets jamais réfléchis", async () => {
  const env: NodeJS.ProcessEnv = { NODE_ENV: "test", SIGNUP_PAYMENT_ADAPTER: "stripe-sandbox", STRIPE_SECRET_KEY: "sk_test_unit_only", STRIPE_WEBHOOK_SECRET: "whsec_unit_only", VERCEL_ENV: "preview" };
  stripe.assertStripeSandbox(env);
  for (const patch of [{ VERCEL_ENV: "production" }, { STRIPE_SECRET_KEY: "sk_live_no" }, { SIGNUP_PAYMENT_ADAPTER: "fake" }]) assert.throws(() => stripe.assertStripeSandbox({ ...env, ...patch }));
  const provider = new stripe.StripeSandboxProvider(async () => { throw new Error("sk_test_unit_only provider confidential error"); }, env);
  await assert.rejects(provider.checkoutSubscription("cs_test"), /^Error: BILLING_PROVIDER_UNAVAILABLE$/);
});


test("SAAS-01B : une facture de renouvellement au mauvais montant/TVA/contrat/période ne prolonge pas les droits", () => {
  const renewal = { ...invoice, id: "in_renewal", reason: "subscription_cycle", periodStart: invoice.periodEnd, periodEnd: "2026-03-01T00:00:00.000Z" };
  for (const patch of [
    { invoices: [invoice, { ...renewal, subtotalCents: 1, taxCents: 0, totalCents: 1, paidCents: 1 }] },
    { invoices: [invoice, { ...renewal, subtotalCents: 7901, taxCents: 1579 }] },
    { contractHash: "other", invoices: [invoice, renewal] },
    { periodEnd: "2026-04-01T00:00:00Z", invoices: [invoice, renewal] },
  ]) {
    const result = core.reconcileBilling(active(), { ...snapshot, periodEnd: renewal.periodEnd, ...patch }, new Date(invoice.periodEnd));
    assert.equal(result.periodEnd, invoice.periodEnd); assert.equal(result.status, "PAST_DUE");
  }
});

test("SAAS-01B : transport Stripe2024 récupère prix/TVA/période/remboursement et refuse tenant/devise/live", async () => {
  const env: NodeJS.ProcessEnv = { NODE_ENV: "test", SIGNUP_PAYMENT_ADAPTER: "stripe-sandbox", STRIPE_SECRET_KEY: "sk_test_unit_only", STRIPE_WEBHOOK_SECRET: "whsec_unit_only" };
  const from = 1767225600, to = 1769904000;
  const subscription = { id: "sub_test", livemode: false, customer: "cus_test", metadata: { tutelliv_account: "account" }, status: "active", current_period_start: from, current_period_end: to, cancel_at_period_end: false, pending_update: null, items: { data: [{ id: "si_test", price: { id: "price_test", metadata: { contract_hash: contract.hash } } }] } };
  const rawInvoice = { id: "in_initial", livemode: false, currency: "eur", subscription: "sub_test", customer: "cus_test", metadata: {}, charge: "ch_test", status: "paid", total: 9480, total_excluding_tax: 7900, amount_paid: 9480, created: from, billing_reason: "subscription_create", period_start: from, period_end: from, hosted_invoice_url: null, lines: { data: [{ type: "subscription", proration: false, period: { start: from, end: to } }] } };
  let override: Record<string, unknown> = {};
  const provider = new stripe.StripeSandboxProvider(async (url, init) => {
    assert.equal((init?.headers as Record<string, string>)["Stripe-Version"], "2024-06-20");
    const path = new URL(String(url)).pathname;
    const data = path.endsWith("sub_test") ? subscription : path.endsWith("ch_test") ? { id: "ch_test", amount_refunded: 100, livemode: false } : { data: [{ ...rawInvoice, ...override }], has_more: false };
    return Response.json(data);
  }, env);
  const result = await provider.snapshot("sub_test", "account");
  assert.equal(result.invoices[0]?.taxCents, 1580); assert.equal(result.invoices[0]?.refundedCents, 100);
  assert.equal(result.invoices[0]?.periodEnd, invoice.periodEnd);
  await assert.rejects(provider.snapshot("sub_test", "another"), /TENANT_MISMATCH/);
  for (const patch of [{ currency: "usd" }, { livemode: true }]) { override = patch; await assert.rejects(provider.snapshot("sub_test", "account"), /SANDBOX_REQUIRED/); }
  override = { amount_paid: 99999 };
  assert.throws(() => core.reconcileBilling(active(), { ...snapshot, invoices: [{ ...invoice, paidCents: 99999 }] }, now), /INVOICE_MISMATCH/);
});

test("SAAS-01B : cron inerte hors sandbox, inscription conservée si Checkout interrompu", () => {
  const cron = readFileSync(resolve("src/app/api/cron/billing/route.ts"), "utf8");
  const vercel = readFileSync(resolve("vercel.json"), "utf8");
  const ui = readFileSync(resolve("src/features/auth/signup-wizard.tsx"), "utf8");
  const service = readFileSync(resolve("src/domains/billing/billing.service.ts"), "utf8");
  assert.match(cron, /SIGNUP_PAYMENT_ADAPTER !== "stripe-sandbox"/);
  assert.match(cron, /skipped: true/);
  assert.match(vercel, /\/api\/cron\/billing/);
  // Offre Vercel Hobby : un cron plus fréquent qu'une fois par jour fait échouer tout déploiement.
  for (const { path, schedule } of (JSON.parse(vercel) as { crons: Array<{ path: string; schedule: string }> }).crons) {
    const [minute, hour] = schedule.split(" ");
    assert.match(`${minute} ${hour}`, /^\d{1,2} \d{1,2}$/, `${path} : au plus une fois par jour (${schedule})`);
  }
  assert.match(ui, /get\("payment"\) === "cancelled"/);
  assert.match(readFileSync(resolve("src/domains/billing/stripe-sandbox.ts"), "utf8"), /\/register\?payment=cancelled/);
  assert.match(ui, /Le paiement sandbox a été interrompu\. Votre inscription est conservée\./);
  assert.match(ui, /Le paiement sandbox est indisponible\. Votre inscription est conservée\./);
  assert.equal([...service.matchAll(/closedAt: new Date\(\)/g)].length, 1);
  assert.match(service, /if \(input\.kind === "USAGE"\) await tx\.saasUsagePeriod\.update\(\{ where: \{ id: input\.periodId \}/);
});
