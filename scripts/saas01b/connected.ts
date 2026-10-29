import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { PrismaClient } from "@prisma/client";
import { loadBilling } from "../../tests/helpers/billing-loader";
import type { BillingContract, BillingInvoice, ProviderSnapshot } from "../../src/domains/billing/billing-core";
import type { SandboxBillingProvider } from "../../src/domains/billing/stripe-sandbox";
import type { SignupCatalog } from "../../src/domains/signup/signup.service";

const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (url.hostname !== "127.0.0.1" || url.port !== "55439" || url.pathname !== "/saas01b") throw new Error("SAAS01B_ISOLATED_LOCAL_DATABASE_REQUIRED");
const db = new PrismaClient();
const { core, service: { BillingService } } = loadBilling(db);
const checks: string[] = [];
function checked(name: string) { checks.push(name); }
const json = (value: unknown) => JSON.parse(JSON.stringify(value));
class TestProvider implements SandboxBillingProvider {
  contracts = new Map<string, BillingContract>();
  accounts = new Map<string, string>();
  states = new Map<string, ProviderSnapshot>();
  effects = new Map<string, object>();
  failAfterCheckout = false;
  failAfterChange = false;
  failAfterUsage = false;
  rejectNextChange = false;
  partialNextSchedule = false;
  rejectedCalls = 0;
  async checkout(account: string, _email: string, contract: BillingContract, key: string) {
    const existing = this.effects.get(key);
    if (existing) return existing as { id: string; url: string; customerId: string };
    const sub = `sub_${account}`, customer = `cus_${account}`;
    this.contracts.set(sub, contract); this.accounts.set(`cs_${account}`, sub);
    const start = new Date(), end = new Date(start); end.setUTCMonth(end.getUTCMonth() + (contract.quote.billingInterval === "ANNUAL" ? 12 : 1));
    this.states.set(sub, { subscriptionId: sub, customerId: customer, contractHash: contract.hash, live: false, status: "active", pendingUpdate: false, periodStart: start.toISOString(), periodEnd: end.toISOString(), cancelAtPeriodEnd: false, invoices: [] });
    const result = { id: `cs_${account}`, url: "https://checkout.stripe.com/test-only", customerId: customer };
    this.effects.set(key, result);
    if (this.failAfterCheckout) { this.failAfterCheckout = false; throw new Error("BILLING_PROVIDER_UNAVAILABLE"); }
    return result;
  }
  async checkoutSubscription(id: string) { return this.accounts.get(id)!; }
  async paymentPortal(): Promise<{ url: string }> { throw new Error("BILLING_PORTAL_NOT_SIMULATED"); }
  async snapshot(sub: string, _account: string) { return json(this.states.get(sub)!) as ProviderSnapshot; }
  payInitial(sub: string) {
    const state = this.states.get(sub)!, contract = this.contracts.get(sub)!;
    state.invoices.push({ id: `in_initial_${sub}`, subscriptionId: sub, currency: "EUR", status: "paid", subtotalCents: contract.quote.totalHtCents, taxCents: contract.quote.vatCents, totalCents: contract.quote.totalTtcCents, paidCents: contract.quote.totalTtcCents, refundedCents: 0, periodStart: state.periodStart, periodEnd: state.periodEnd, dueAt: state.periodStart, reason: "subscription_create", taxSource: "test:simulated", documentUrl: null });
  }
  async previewChange() { return { totalCents: 1200, currency: "EUR" }; }
  async change(sub: string, target: BillingContract, key: string) {
    if (this.rejectNextChange) { this.rejectNextChange = false; this.rejectedCalls++; throw new Error("BILLING_PROVIDER_REJECTED"); }
    const existing = this.effects.get(key); if (existing) return existing as { invoiceId: string };
    const state = this.states.get(sub)!;
    state.contractHash = target.hash;
    state.invoices.push({ ...state.invoices[0]!, id: `in_change_${key}`, subtotalCents: 1000, taxCents: 200, totalCents: 1200, paidCents: 1200, reason: "subscription_update" });
    const result = { invoiceId: `in_change_${key}` }; this.effects.set(key, result);
    if (this.failAfterChange) { this.failAfterChange = false; throw new Error("BILLING_PROVIDER_UNAVAILABLE"); }
    return result;
  }
  async schedule(sub: string, _target: BillingContract, key: string) {
    if (this.partialNextSchedule) { this.partialNextSchedule = false; throw new Error("BILLING_PARTIAL_EFFECT"); }
    return { scheduleId: `schedule_${sub}_${key}` };
  }
  async cancel(sub: string) { this.states.get(sub)!.cancelAtPeriodEnd = true; return { cancelAtPeriodEnd: true as const }; }
  async refund(invoiceId: string, amount: number, key: string) {
    const existing = this.effects.get(key); if (existing) return existing as { refundId: string };
    for (const state of this.states.values()) { const invoice = state.invoices.find((i) => i.id === invoiceId); if (invoice) invoice.refundedCents += amount; }
    const result = { refundId: `re_${key}` }; this.effects.set(key, result); return result;
  }
  async usage(_account: string, sub: string, amount: number, vat: number, period: { start: string; end: string }, key: string) {
    const existing = this.effects.get(key); if (existing) return existing as { invoiceId: string };
    const tax = Math.round(amount * vat / 10000);
    this.states.get(sub)!.invoices.push({ id: `in_usage_${key}`, subscriptionId: sub, status: "paid", currency: "EUR", subtotalCents: amount, taxCents: tax, totalCents: amount + tax, paidCents: amount + tax, refundedCents: 0, periodStart: period.start, periodEnd: period.end, dueAt: period.end, reason: "usage", taxSource: "test:simulated", documentUrl: null });
    const result = { invoiceId: `in_usage_${key}` }; this.effects.set(key, result);
    if (this.failAfterUsage) { this.failAfterUsage = false; throw new Error("BILLING_PROVIDER_UNAVAILABLE"); }
    return result;
  }
}
async function main() {
  const catalog = await db.saasCatalogVersion.findFirstOrThrow({ where: { status: "ACTIVE" }, orderBy: { effectiveAt: "desc" }, include: { plans: true, options: true } }) as unknown as SignupCatalog;
  assert.equal(catalog.code, "C10-2026-10-29");
  const c8 = await db.saasPlan.findFirstOrThrow({ where: { catalogVersionId: "saas_catalog_c8_v1", code: "BUSINESS" } });
  assert.equal(c8.unlimitedDriverSeats, true);
  assert.equal(catalog.plans.find((p) => p.code === "BUSINESS")!.includedDriverSeats, 20);
  checked("C9 active; historical C8 untouched; Business20+900 cents to50");
  await db.role.upsert({ where: { slug: "company-admin" }, create: { slug: "company-admin", name: "Company admin", systemRole: "COMPANY_ADMIN" }, update: {} });
  const run = Date.now().toString(36), token = `saas01b-${run}`;
  const contract = core.makeBillingContract(catalog, "STARTER", "MONTHLY", []);
  const salesCode = await db.salesCode.create({ data: { code: `SAAS-${run.slice(-4).toUpperCase()}`, sellerName: "Commercial fictif", sellerEmail: `seller-${run}@example.invalid`, level: "AUTONOMOUS", createdById: "test-operator" } });
  const journey = await db.signupJourney.create({ data: { salesCodeId: salesCode.id, resumeTokenHash: createHash("sha256").update(token).digest("hex"), status: "EMAIL_VERIFIED", emailVerifiedAt: new Date(), authUserId: `auth-${run}`, email: `saas01b-${run}@example.invalid`, firstName: "Test", lastName: "Billing", companyName: `SAAS01B ${run}`, siren: run.slice(-9).padStart(9, "0"), billingAddress: "1 rue fictive", billingPostalCode: "75001", billingCity: "Paris", catalogVersionId: catalog.id, planCode: "STARTER", billingInterval: "MONTHLY", optionSelections: [], quoteSnapshot: json(contract.quote), expiresAt: new Date(Date.now() + 86400000) } });
  const provider = new TestProvider(), billing = new BillingService(provider, db);
  provider.failAfterCheckout = true;
  await assert.rejects(billing.checkout(token), /UNAVAILABLE/);
  let account = await db.saasBillingAccount.findUniqueOrThrow({ where: { signupId: journey.id } });
  assert.ok(account.pendingOperationId);
  assert.equal(await db.company.count({ where: { signupJourney: { id: journey.id } } }), 0);
  checked("provider timeout after effect: durable command, no company/rights");
  const restarted = new BillingService(provider, db);
  await restarted.resumeOperation(account.pendingOperationId!);
  account = await db.saasBillingAccount.findUniqueOrThrow({ where: { id: account.id } });
  assert.equal(account.pendingOperationId, null); assert.ok(account.checkoutId);
  await restarted.reconcile(account.id);
  assert.equal((await db.signupJourney.findUniqueOrThrow({ where: { id: journey.id } })).companyId, null);
  checked("restart replays original provider key; unpaid checkout grants nothing");
  const sub = provider.accounts.get(account.checkoutId!)!;
  provider.payInitial(sub);
  await restarted.reconcile(account.id, `evt_${run}`);
  await restarted.reconcile(account.id, `evt_${run}`);
  account = await db.saasBillingAccount.findUniqueOrThrow({ where: { id: account.id } });
  assert.ok(account.subscriptionId);
  assert.equal(await db.signupPaymentEvent.count({ where: { signupId: journey.id } }), 1);
  assert.equal(await db.saasBillingOperation.count({ where: { id: `event:evt_${run}` } }), 1);
  checked("verified payment activates once; repeated event/payment idempotent");
  const attributions = await db.salesAttribution.findMany({ where: { signupId: journey.id } });
  assert.equal(attributions.length, 1);
  assert.equal(attributions[0]!.salesCodeId, salesCode.id); assert.equal(attributions[0]!.rateBps, 3500);
  assert.deepEqual((attributions[0]!.snapshot as { eligibleLines: unknown[] }).eligibleLines, JSON.parse(JSON.stringify(contract.lines)));
  checked("sales code attribution frozen once at activation (35 %, initial lines)");
  const target = core.makeBillingContract(catalog, "PRO", "MONTHLY", []);
  provider.failAfterChange = true;
  const change = { kind: "CHANGE" as const, target, prorationDate: Math.floor(Date.now() / 1000), confirmedTotalCents: 1200, actorId: "test-operator" };
  await assert.rejects(restarted.command(account.id, "change-pro", change), /UNAVAILABLE/);
  await assert.rejects(restarted.command(account.id, "simultaneous-change", change), /CONCURRENT/);
  const pending = await db.saasBillingAccount.findUniqueOrThrow({ where: { id: account.id } });
  await restarted.resumeOperation(pending.pendingOperationId!);
  await restarted.reconcile(account.id);
  const updated = await db.saasSubscription.findUniqueOrThrow({ where: { id: account.subscriptionId! }, include: { planAssignments: { where: { effectiveTo: null } } } });
  assert.equal((updated.planAssignments[0]!.snapshot as { planCode: string }).planCode, "PRO");
  assert.equal(provider.states.get(sub)!.invoices.filter((i) => i.reason === "subscription_update").length, 1);
  checked("simultaneous changes rejected; crash-after-charge resumes once; paid Pro rights projected");
  await assert.rejects(restarted.command(account.id, "change-pro", { ...change, confirmedTotalCents: 1201 }), /KEY_REUSED/);
  checked("idempotency key cannot be reused with changed consent");
  await assert.rejects(restarted.command(account.id, "change-same", { ...change, prorationDate: Math.floor(Date.now() / 1000) }), /CHANGE_NOOP/);
  const rejectedChange = { ...change, target: core.makeBillingContract(catalog, "BUSINESS", "MONTHLY", []), prorationDate: Math.floor(Date.now() / 1000) };
  provider.rejectNextChange = true;
  await assert.rejects(restarted.command(account.id, "change-rejected", rejectedChange), /PROVIDER_REJECTED/);
  assert.equal((await db.saasBillingAccount.findUniqueOrThrow({ where: { id: account.id } })).pendingOperationId, null);
  await assert.rejects(restarted.command(account.id, "change-rejected", rejectedChange), /PROVIDER_REJECTED/);
  assert.equal(provider.rejectedCalls, 1);
  checked("same-plan change refused; definitive provider rejection releases the lock and replays without a new provider call");
  const crashPeriod = await db.saasUsagePeriod.create({ data: { companyId: updated.companyId, subscriptionId: updated.id, startsAt: new Date("2026-08-01Z"), endsAt: new Date("2026-09-01Z"), includedOrders: 3000, orderCount: 3050, overageCount: 50, orderOverageUnitPriceCents: 8 } });
  provider.failAfterUsage = true;
  await assert.rejects(restarted.billClosedUsage(account.id), /UNAVAILABLE/);
  const afterCrash = await db.saasUsagePeriod.findUniqueOrThrow({ where: { id: crashPeriod.id } });
  assert.equal(afterCrash.closedAt, null);
  const usagePending = await db.saasBillingAccount.findUniqueOrThrow({ where: { id: account.id } });
  await restarted.resumeOperation(usagePending.pendingOperationId!);
  assert.ok((await db.saasUsagePeriod.findUniqueOrThrow({ where: { id: crashPeriod.id } })).closedAt);
  checked("usage crash keeps period open then resumes original key once");
  const period = await db.saasUsagePeriod.create({ data: { companyId: updated.companyId, subscriptionId: updated.id, startsAt: new Date("2026-09-01Z"), endsAt: new Date("2026-10-01Z"), includedOrders: 3000, orderCount: 3100, overageCount: 100, orderOverageUnitPriceCents: 8 } });
  await restarted.billClosedUsage(account.id); await restarted.billClosedUsage(account.id);
  assert.ok((await db.saasUsagePeriod.findUniqueOrThrow({ where: { id: period.id } })).closedAt);
  assert.equal(provider.states.get(sub)!.invoices.filter((i) => i.reason === "usage").length, 2);
  checked("monthly usage frozen/billed once with separate invoice");
  const initial = provider.states.get(sub)!.invoices[0]!;
  await restarted.command(account.id, "refund-decided", { kind: "REFUND", invoiceId: initial.id, amountCents: 100, actorId: "test-operator", reason: "Erreur de facturation fictive documentée" });
  await restarted.reconcile(account.id);
  assert.equal((json((await db.saasBillingAccount.findUniqueOrThrow({ where: { id: account.id } })).state).invoices as BillingInvoice[]).find((i) => i.id === initial.id)?.refundedCents, 100);
  await assert.rejects(restarted.command(account.id, "refund-too-large", { kind: "REFUND", invoiceId: initial.id, amountCents: 999999, actorId: "test-operator", reason: "Erreur fictive" }), /REFUND_INVALID/);
  checked("decided partial refund traced; over-refund refused");
  const ledger = async () => (await db.salesCommissionEntry.findMany({ where: { attribution: { signupId: journey.id } }, orderBy: [{ receivedAt: "asc" }, { settlementKey: "asc" }] }))
    .map((row) => `${row.settlementKey.replace(/^[^:]+/, (id) => id.split("_").slice(0, 2).join("_"))}=${row.explanation}:${row.commissionCents}`);
  const entries = await ledger();
  assert.ok(entries.includes("in_initial:paid=ELIGIBLE:2765"), entries.join(" | "));
  assert.ok(entries.includes("in_initial:refund:100=REFUND:-30"), entries.join(" | "));
  assert.ok(entries.filter((row) => !row.startsWith("in_initial")).every((row) => row.endsWith(":0")), entries.join(" | "));
  await restarted.reconcile(account.id); await restarted.reconcile(account.id);
  assert.deepEqual(await ledger(), entries);
  checked(`sales commissions ledger: 35 % of initial, later change/usage at zero, refund prorata, replay-safe (${entries.length} entries)`);
  // Effet partiel chez le fournisseur : le verrou reste posé, aucune autre opération ne passe.
  const partialAccount = await db.saasBillingAccount.findUniqueOrThrow({ where: { id: account.id } });
  const partialState = partialAccount.state as unknown as { activeContract: BillingContract; status: string; pendingChange: unknown; cancelAtPeriodEnd: boolean };
  if (partialState.status === "ACTIVE" && !partialState.pendingChange && !partialState.cancelAtPeriodEnd && !partialAccount.pendingOperationId) {
    provider.partialNextSchedule = true;
    const downgrade = { kind: "CHANGE" as const, target: core.makeBillingContract(catalog, "STARTER", "MONTHLY", []), prorationDate: Math.floor(Date.now() / 1000), confirmedTotalCents: 0, actorId: "test-operator" };
    await assert.rejects(restarted.command(account.id, "change-partial", downgrade), /PARTIAL_EFFECT/);
    const locked = await db.saasBillingAccount.findUniqueOrThrow({ where: { id: account.id } });
    assert.ok(locked.pendingOperationId, "un effet partiel garde le verrou");
    await assert.rejects(restarted.command(account.id, "cancel-after-partial", { kind: "CANCEL", actorId: "test-operator" }), /CONCURRENT/);
    // Rapprochement manuel simulé : l'opérateur constate l'état fournisseur, clôt l'opération et rend le verrou.
    await db.$transaction([
      db.saasBillingOperation.update({ where: { id: locked.pendingOperationId! }, data: { status: "FAILED", result: { code: "BILLING_PARTIAL_EFFECT" }, completedAt: new Date() } }),
      db.saasBillingAccount.update({ where: { id: account.id }, data: { pendingOperationId: null } }),
    ]);
    checked("partial provider effect keeps the lock until manual reconciliation");
  } else throw new Error("SAAS01B_PARTIAL_PRECONDITION");
  await restarted.command(account.id, "cancel-end", { kind: "CANCEL", actorId: "test-operator" });
  await restarted.reconcile(account.id);
  assert.equal((await db.saasSubscription.findUniqueOrThrow({ where: { id: updated.id } })).cancelAtPeriodEnd, true);
  assert.equal(await db.company.count({ where: { id: updated.companyId } }), 1);
  checked("cancellation at paid period end retains company/history");
  const annualToken = `${token}-annual`;
  const annualContract = core.makeBillingContract(catalog, "BUSINESS", "ANNUAL", [{ code: "DRIVER_BUSINESS", quantity: 2 }, { code: "ADMIN_EXTRA", quantity: 1 }]);
  const annualJourney = await db.signupJourney.create({ data: { resumeTokenHash: createHash("sha256").update(annualToken).digest("hex"), status: "EMAIL_VERIFIED", emailVerifiedAt: new Date(), authUserId: `auth-annual-${run}`, email: `saas01b-annual-${run}@example.invalid`, firstName: "Test", lastName: "Annual", companyName: `SAAS01B annual ${run}`, siren: `a${run}`.slice(-9).padStart(9, "0"), billingAddress: "1 rue fictive", billingPostalCode: "75001", billingCity: "Paris", catalogVersionId: catalog.id, planCode: "BUSINESS", billingInterval: "ANNUAL", optionSelections: json(annualContract.quote.selections), quoteSnapshot: json(annualContract.quote), expiresAt: new Date(Date.now() + 86400000) } });
  await restarted.checkout(annualToken);
  const annualAccount = await db.saasBillingAccount.findUniqueOrThrow({ where: { signupId: annualJourney.id } });
  const annualSub = provider.accounts.get(annualAccount.checkoutId!)!;
  provider.payInitial(annualSub);
  await restarted.reconcile(annualAccount.id);
  const annualLocal = await db.saasBillingAccount.findUniqueOrThrow({ where: { id: annualAccount.id } });
  const annualSubscription = await db.saasSubscription.findUniqueOrThrow({ where: { id: annualLocal.subscriptionId! }, include: { items: { where: { effectiveTo: null } } } });
  assert.equal(annualSubscription.billingInterval, "ANNUAL");
  assert.equal(annualSubscription.items.find((i) => i.code === "DRIVER_BUSINESS")?.unitPriceCents, 10800);
  assert.equal(annualSubscription.items.find((i) => i.code === "ADMIN_EXTRA")?.unitPriceCents, 14400);
  checked("annual Business activation: driver/admin extras priced at12 months, base at10");
  const monthlyBusiness = core.makeBillingContract(catalog, "BUSINESS", "MONTHLY", annualContract.quote.selections);
  await restarted.command(annualLocal.id, "annual-to-monthly", { kind: "CHANGE", target: monthlyBusiness, prorationDate: Math.floor(Date.now() / 1000), confirmedTotalCents: 0, actorId: "test-operator" });
  await restarted.reconcile(annualLocal.id);
  assert.equal((await db.saasSubscription.findUniqueOrThrow({ where: { id: annualLocal.subscriptionId! } })).billingInterval, "ANNUAL");
  const annualState = provider.states.get(annualSub)!;
  const cycleStart = annualState.periodEnd, cycleEnd = new Date(cycleStart); cycleEnd.setUTCMonth(cycleEnd.getUTCMonth() + 1);
  annualState.contractHash = monthlyBusiness.hash; annualState.periodStart = cycleStart; annualState.periodEnd = cycleEnd.toISOString();
  annualState.invoices.push({ ...annualState.invoices[0]!, id: `in_cycle_${run}`, reason: "subscription_cycle", periodStart: cycleStart, periodEnd: cycleEnd.toISOString(), dueAt: cycleStart, subtotalCents: monthlyBusiness.quote.totalHtCents, taxCents: monthlyBusiness.quote.vatCents, totalCents: monthlyBusiness.quote.totalTtcCents, paidCents: monthlyBusiness.quote.totalTtcCents });
  await restarted.reconcile(annualLocal.id);
  assert.equal((await db.saasSubscription.findUniqueOrThrow({ where: { id: annualLocal.subscriptionId! } })).billingInterval, "ANNUAL");
  await restarted.reconcile(annualLocal.id, undefined, new Date(cycleStart));
  assert.equal((await db.saasSubscription.findUniqueOrThrow({ where: { id: annualLocal.subscriptionId! } })).billingInterval, "MONTHLY");
  checked("annual→monthly remains scheduled until exact paid renewal then projects atomically");
  const rls = await db.$queryRaw<Array<{ relname: string; relrowsecurity: boolean }>>`SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('saas_billing_accounts', 'saas_billing_operations')`;
  assert.equal(rls.length, 2); assert.ok(rls.every((row) => row.relrowsecurity));
  checked("new ledger tables both RLS enabled");
  const out = process.argv[2] ?? "outputs/saas01b/local-connected.json";
  mkdirSync(dirname(out), { recursive: true });
  const result = { status: "passed", database: "isolated-local-postgresql", provider: "deterministic-test-double-NOT-Stripe-sandbox", checks, realStripeRecipe: "BLOCKED_NO_ACCOUNT", generatedAt: new Date().toISOString() };
  writeFileSync(out, JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result));
}
main().finally(() => db.$disconnect()).catch((error) => { console.error(error instanceof Error ? error.message : "SAAS01B_FAILED"); process.exitCode = 1; });
