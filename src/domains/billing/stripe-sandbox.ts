import { createHmac, timingSafeEqual } from "node:crypto";
import type { BillingContract, BillingInvoice, ProviderSnapshot } from "./billing-core";
import { cents } from "./billing-core";

type JsonObject = { [key: string]: unknown };
function object(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("BILLING_PROVIDER_RESPONSE_INVALID");
  return value as JsonObject;
}
function array(value: unknown) { if (!Array.isArray(value)) throw new Error("BILLING_PROVIDER_RESPONSE_INVALID"); return value.map(object); }
function str(value: unknown): string { if (typeof value !== "string" || !value) throw new Error("BILLING_PROVIDER_RESPONSE_INVALID"); return value; }
function num(value: unknown): number { if (typeof value !== "number" || !Number.isSafeInteger(value)) throw new Error("BILLING_PROVIDER_RESPONSE_INVALID"); return value; }
function id(value: unknown): string { return typeof value === "string" ? value : str(object(value).id); }
function iso(value: unknown) { return new Date(num(value) * 1000).toISOString(); }
function paidAt(invoice: JsonObject) {
  const transitions = invoice.status_transitions;
  const at = transitions && typeof transitions === "object" ? (transitions as JsonObject).paid_at : null;
  return typeof at === "number" ? iso(at) : null;
}
function encode(input: JsonObject) {
  const params = new URLSearchParams();
  function append(prefix: string, value: unknown) {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) { value.forEach((item, index) => append(`${prefix}[${index}]`, item)); return; }
    if (typeof value === "object") { Object.entries(value).forEach(([key, item]) => append(prefix ? `${prefix}[${key}]` : key, item)); return; }
    params.append(prefix, String(value));
  }
  Object.entries(input).forEach(([key, value]) => append(key, value));
  return params;
}
export function assertStripeSandbox(env: NodeJS.ProcessEnv = process.env) {
  if (env.VERCEL_ENV === "production" || env.SIGNUP_PAYMENT_ADAPTER !== "stripe-sandbox" || !env.STRIPE_SECRET_KEY?.startsWith("sk_test_")) throw new Error("BILLING_SANDBOX_REQUIRED");
  if (!env.STRIPE_WEBHOOK_SECRET?.startsWith("whsec_")) throw new Error("BILLING_WEBHOOK_SECRET_REQUIRED");
}
export function verifyStripeEvent(raw: string, signature: string | null, secret: string, now = Date.now()) {
  if (Buffer.byteLength(raw) > 1_000_000 || !signature || !secret.startsWith("whsec_")) throw new Error("BILLING_SIGNATURE_INVALID");
  const parts = signature.split(",").map((part) => part.trim().split("="));
  const timestamps = parts.filter(([key]) => key === "t");
  const timestamp = Number(timestamps[0]?.[1]);
  if (timestamps.length !== 1 || !Number.isSafeInteger(timestamp) || Math.abs(now / 1000 - timestamp) > 300) throw new Error("BILLING_SIGNATURE_INVALID");
  const expected = createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest();
  const matches = parts.filter(([key]) => key === "v1").some(([, value]) => {
    if (!/^[a-f0-9]{64}$/i.test(value ?? "")) return false;
    const actual = Buffer.from(value!, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  });
  if (!matches) throw new Error("BILLING_SIGNATURE_INVALID");
  const event = object(JSON.parse(raw));
  if (event.livemode !== false || event.account) throw new Error("BILLING_SANDBOX_REQUIRED");
  const eventObject = object(object(event.data).object);
  return { id: str(event.id), type: str(event.type), object: eventObject };
}
export type CheckoutResult = { id: string; url: string; customerId: string };
export interface SandboxBillingProvider {
  checkout(accountId: string, email: string, contract: BillingContract, key: string): Promise<CheckoutResult>;
  checkoutSubscription(checkoutId: string): Promise<string | null>;
  snapshot(subscriptionId: string, accountId: string): Promise<ProviderSnapshot>;
  previewChange(subscriptionId: string, target: BillingContract, key: string, prorationDate: number): Promise<{ totalCents: number; currency: string }>;
  change(subscriptionId: string, target: BillingContract, key: string, prorationDate: number): Promise<{ invoiceId: string }>;
  schedule(subscriptionId: string, target: BillingContract, key: string): Promise<{ scheduleId: string }>;
  cancel(subscriptionId: string, key: string): Promise<{ cancelAtPeriodEnd: true }>;
  refund(invoiceId: string, amountCents: number, key: string): Promise<{ refundId: string }>;
  usage(accountId: string, subscriptionId: string, amountHtCents: number, vatRateBps: number, period: { start: string; end: string }, key: string): Promise<{ invoiceId: string }>;
  paymentPortal(subscriptionId: string, accountId: string, key: string): Promise<{ url: string }>;
}
/** Portail client limité au moyen de paiement et aux factures : formule et résiliation restent journalisées par Annona. */
export const PAYMENT_PORTAL_CONFIGURATION = "payment-method-v1";
/** Version pinned: snapshot webhooks are only wakeups; all monetary state is retrieved server-side. */
export class StripeSandboxProvider implements SandboxBillingProvider {
  constructor(private readonly fetcher: typeof fetch = fetch, private readonly env: NodeJS.ProcessEnv = process.env) { assertStripeSandbox(env); }
  private async request(method: "GET" | "POST", path: string, body: JsonObject = {}, key?: string): Promise<JsonObject> {
    const params = encode(body);
    let response: Response;
    try {
      response = await this.fetcher(`https://api.stripe.com/v1/${path}${method === "GET" && params.size ? `?${params}` : ""}`, {
        method, headers: { Authorization: `Bearer ${this.env.STRIPE_SECRET_KEY}`, "Stripe-Version": "2024-06-20", ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded", "Idempotency-Key": key! } : {}) },
        body: method === "POST" ? params : undefined, signal: AbortSignal.timeout(20_000), cache: "no-store",
      });
    } catch { throw new Error("BILLING_PROVIDER_UNAVAILABLE"); }
    if (!response.ok) throw new Error(response.status === 429 || response.status >= 500 ? "BILLING_PROVIDER_UNAVAILABLE" : "BILLING_PROVIDER_REJECTED");
    const result = object(await response.json());
    if (result.livemode === true) throw new Error("BILLING_SANDBOX_REQUIRED");
    return result;
  }
  private async list(path: string, query: JsonObject) {
    const result: JsonObject[] = [];
    for (let page = 0; page < 100; page++) {
      const response = await this.request("GET", path, { ...query, limit: 100, starting_after: result.length ? result[result.length - 1]!.id : undefined });
      const data = array(response.data); result.push(...data);
      if (!response.has_more) return result;
      if (!data.length) break;
    }
    throw new Error("BILLING_RECONCILIATION_INCOMPLETE");
  }
  private async tax(rate: number) {
    if (!rate) return [];
    const tax = await this.request("POST", "tax_rates", { display_name: "TVA simulée", inclusive: false, percentage: rate / 100, country: "FR", description: "Sandbox Annona — taux simulé, non validation fiscale" }, `annona:tax:${rate}:v1`);
    return [str(tax.id)];
  }
  private async price(contract: BillingContract) {
    const product = await this.request("POST", "products", { name: `Annona ${contract.quote.planName} — sandbox`, metadata: { contract_hash: contract.hash, catalog: contract.quote.catalogCode } }, `annona:product:${contract.hash}`);
    const price = await this.request("POST", "prices", { product: product.id, currency: "eur", unit_amount: contract.quote.totalHtCents, tax_behavior: "exclusive", recurring: { interval: contract.quote.billingInterval === "ANNUAL" ? "year" : "month" }, metadata: { contract_hash: contract.hash } }, `annona:price:${contract.hash}`);
    return str(price.id);
  }
  private origin() {
    const origin = new URL(this.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");
    if (!["https:", "http:"].includes(origin.protocol) || (origin.protocol === "http:" && !["localhost", "127.0.0.1"].includes(origin.hostname))) throw new Error("BILLING_RETURN_URL_INVALID");
    return origin;
  }
  async checkout(accountId: string, email: string, contract: BillingContract, key: string) {
    const origin = this.origin();
    const customer = await this.request("POST", "customers", { email, metadata: { annona_account: accountId } }, `${key}:customer`);
    const price = await this.price(contract);
    const taxRates = await this.tax(contract.quote.vatRateBps);
    const checkout = await this.request("POST", "checkout/sessions", {
      mode: "subscription", customer: customer.id, client_reference_id: accountId,
      payment_method_types: ["card"], line_items: [{ price, quantity: 1, tax_rates: taxRates }],
      subscription_data: { metadata: { annona_account: accountId }, default_tax_rates: taxRates },
      metadata: { annona_account: accountId },
      success_url: new URL("/register?payment=return", origin).href,
      cancel_url: new URL("/register?payment=cancelled", origin).href,
    }, key);
    const url = str(checkout.url);
    if (new URL(url).hostname !== "checkout.stripe.com") throw new Error("BILLING_CHECKOUT_URL_INVALID");
    return { id: str(checkout.id), url, customerId: str(customer.id) };
  }
  async checkoutSubscription(checkoutId: string) {
    const session = await this.request("GET", `checkout/sessions/${encodeURIComponent(checkoutId)}`);
    if (session.status === "expired") throw new Error("BILLING_CHECKOUT_EXPIRED");
    if (session.status !== "complete" || session.payment_status !== "paid") return null;
    return id(session.subscription);
  }
  async snapshot(subscriptionId: string, accountId: string): Promise<ProviderSnapshot> {
    const subscription = await this.request("GET", `subscriptions/${encodeURIComponent(subscriptionId)}`);
    if (object(subscription.metadata).annona_account !== accountId) throw new Error("BILLING_TENANT_MISMATCH");
    const customerId = id(subscription.customer);
    const rawInvoices = await this.list("invoices", { customer: customerId });
    const invoices: BillingInvoice[] = [];
    for (const invoice of rawInvoices) {
      const metadata = object(invoice.metadata ?? {});
      if (invoice.subscription !== subscriptionId && metadata.annona_account !== accountId) continue;
      if (invoice.livemode !== false || invoice.currency !== "eur") throw new Error("BILLING_SANDBOX_REQUIRED");
      let refundedCents = 0;
      if (invoice.charge) {
        const charge = await this.request("GET", `charges/${encodeURIComponent(id(invoice.charge))}`);
        refundedCents = num(charge.amount_refunded);
      }
      const total = num(invoice.total), subtotal = num(invoice.total_excluding_tax ?? invoice.subtotal);
      const status = str(invoice.status) as BillingInvoice["status"];
      if (!["draft", "open", "paid", "void", "uncollectible"].includes(status)) throw new Error("BILLING_PROVIDER_RESPONSE_INVALID");
      // Renewal coverage comes from recurring invoice lines, not invoice.period_end (usage window).
      const lines = array(object(invoice.lines).data);
      const recurring = lines.filter((line) => line.type === "subscription" && line.proration !== true);
      const periods = (recurring.length ? recurring : lines).map((line) => object(line.period));
      const start = metadata.usage_start ?? (periods.length ? iso(Math.min(...periods.map((p) => num(p.start)))) : iso(invoice.period_start));
      const end = metadata.usage_end ?? (periods.length ? iso(Math.max(...periods.map((p) => num(p.end)))) : iso(invoice.period_end));
      invoices.push({ id: str(invoice.id), subscriptionId, status, currency: "EUR", subtotalCents: subtotal, taxCents: total - subtotal, totalCents: total, paidCents: num(invoice.amount_paid), refundedCents, periodStart: str(start), periodEnd: str(end), dueAt: iso(invoice.due_date ?? invoice.created), reason: metadata.usage_start ? "usage" : str(invoice.billing_reason), taxSource: `stripe:${invoice.id}:tax_rates:simulated`, documentUrl: typeof invoice.hosted_invoice_url === "string" ? invoice.hosted_invoice_url : null, paidAt: paidAt(invoice) });
    }
    const items = array(object(subscription.items).data);
    const hash = items.length === 1 ? object(object(items[0]!.price).metadata ?? {}).contract_hash : null;
    return { subscriptionId, customerId, live: false, status: str(subscription.status), contractHash: typeof hash === "string" ? hash : null, periodStart: iso(subscription.current_period_start), periodEnd: iso(subscription.current_period_end), cancelAtPeriodEnd: subscription.cancel_at_period_end === true, pendingUpdate: Boolean(subscription.pending_update), invoices };
  }
  private async changeParams(subscriptionId: string, target: BillingContract) {
    const subscription = await this.request("GET", `subscriptions/${encodeURIComponent(subscriptionId)}`);
    if (subscription.schedule || subscription.cancel_at_period_end) throw new Error("BILLING_CHANGE_CONFLICT");
    const items = array(object(subscription.items).data);
    if (items.length !== 1) throw new Error("BILLING_CHANGE_CONFLICT");
    return { subscription, item: items[0]!, price: await this.price(target) };
  }
  async previewChange(subscriptionId: string, target: BillingContract, _key: string, prorationDate: number) {
    const { item, price } = await this.changeParams(subscriptionId, target);
    const invoice = await this.request("GET", "invoices/upcoming", { subscription: subscriptionId, subscription_items: [{ id: item.id, price }], subscription_proration_date: prorationDate, subscription_proration_behavior: "always_invoice" });
    return { totalCents: cents(num(invoice.amount_due)), currency: str(invoice.currency).toUpperCase() };
  }
  async change(subscriptionId: string, target: BillingContract, key: string, prorationDate: number) {
    const { item, price } = await this.changeParams(subscriptionId, target);
    const result = await this.request("POST", `subscriptions/${encodeURIComponent(subscriptionId)}`, { items: [{ id: item.id, price }], payment_behavior: "pending_if_incomplete", proration_behavior: "always_invoice", proration_date: prorationDate }, key);
    return { invoiceId: id(result.latest_invoice) };
  }
  /** Après une première étape appliquée, un refus n'est plus un échec sans effet : le verrou doit rester. */
  private async afterFirstEffect<T>(run: () => Promise<T>): Promise<T> {
    try { return await run(); }
    catch (error) {
      if (error instanceof Error && error.message === "BILLING_PROVIDER_REJECTED") throw new Error("BILLING_PARTIAL_EFFECT");
      throw error;
    }
  }
  async schedule(subscriptionId: string, target: BillingContract, key: string) {
    const subscription = await this.request("GET", `subscriptions/${encodeURIComponent(subscriptionId)}`);
    if (subscription.pending_update || subscription.cancel_at_period_end) throw new Error("BILLING_CHANGE_CONFLICT");
    const schedule = await this.request("POST", "subscription_schedules", { from_subscription: subscriptionId }, `${key}:create`);
    const phase = object(schedule.current_phase);
    const items = array(object(subscription.items).data);
    await this.afterFirstEffect(async () => this.request("POST", `subscription_schedules/${encodeURIComponent(str(schedule.id))}`, { end_behavior: "release", phases: [
      { start_date: phase.start_date, end_date: phase.end_date, items: items.map((item) => ({ price: id(item.price), quantity: num(item.quantity) })), default_tax_rates: await this.tax(target.quote.vatRateBps), proration_behavior: "none" },
      { items: [{ price: await this.price(target), quantity: 1 }], iterations: 1, default_tax_rates: await this.tax(target.quote.vatRateBps), proration_behavior: "none" },
    ] }, `${key}:update`));
    return { scheduleId: str(schedule.id) };
  }
  async cancel(subscriptionId: string, key: string) {
    const subscription = await this.request("GET", `subscriptions/${encodeURIComponent(subscriptionId)}`);
    const cancel = () => this.request("POST", `subscriptions/${encodeURIComponent(subscriptionId)}`, { cancel_at_period_end: true }, key);
    if (subscription.schedule) {
      await this.request("POST", `subscription_schedules/${encodeURIComponent(id(subscription.schedule))}/release`, {}, `${key}:release`);
      await this.afterFirstEffect(cancel);
    } else await cancel();
    return { cancelAtPeriodEnd: true as const };
  }
  async refund(invoiceId: string, amountCents: number, key: string) {
    const invoice = await this.request("GET", `invoices/${encodeURIComponent(invoiceId)}`);
    if (invoice.status !== "paid" || !invoice.payment_intent) throw new Error("BILLING_REFUND_INVALID");
    const refund = await this.request("POST", "refunds", { payment_intent: id(invoice.payment_intent), amount: cents(amountCents), metadata: { annona_decision: key } }, key);
    return { refundId: str(refund.id) };
  }
  async usage(accountId: string, subscriptionId: string, amountHtCents: number, vatRateBps: number, period: { start: string; end: string }, key: string) {
    const subscription = await this.request("GET", `subscriptions/${encodeURIComponent(subscriptionId)}`);
    if (object(subscription.metadata).annona_account !== accountId) throw new Error("BILLING_TENANT_MISMATCH");
    const invoice = await this.request("POST", "invoices", { customer: id(subscription.customer), auto_advance: false, collection_method: "charge_automatically", pending_invoice_items_behavior: "exclude", default_tax_rates: await this.tax(vatRateBps), metadata: { annona_account: accountId, usage_start: period.start, usage_end: period.end } }, `${key}:invoice`);
    await this.request("POST", "invoiceitems", { customer: id(subscription.customer), invoice: invoice.id, amount: cents(amountHtCents), currency: "eur", description: `Dépassements mensuels ${period.start} — ${period.end}`, period: { start: Date.parse(period.start) / 1000, end: Date.parse(period.end) / 1000 } }, `${key}:item`);
    await this.request("POST", `invoices/${encodeURIComponent(str(invoice.id))}/finalize`, { auto_advance: true }, `${key}:finalize`);
    return { invoiceId: str(invoice.id) };
  }
  // Une clé d'idempotence expire après 24 h : la configuration est retrouvée par sa métadonnée, jamais dupliquée.
  private async portalConfiguration() {
    const existing = (await this.list("billing_portal/configurations", { active: true }))
      .find((configuration) => object(configuration.metadata ?? {}).annona_portal === PAYMENT_PORTAL_CONFIGURATION);
    if (existing) return str(existing.id);
    const created = await this.request("POST", "billing_portal/configurations", {
      business_profile: { headline: "Annona — moyen de paiement et factures (sandbox)" },
      features: {
        payment_method_update: { enabled: true },
        invoice_history: { enabled: true },
        customer_update: { enabled: false },
        subscription_cancel: { enabled: false },
        subscription_update: { enabled: false },
      },
      metadata: { annona_portal: PAYMENT_PORTAL_CONFIGURATION },
    }, `annona:portal-configuration:${PAYMENT_PORTAL_CONFIGURATION}`);
    return str(created.id);
  }
  async paymentPortal(subscriptionId: string, accountId: string, key: string) {
    const subscription = await this.request("GET", `subscriptions/${encodeURIComponent(subscriptionId)}`);
    if (object(subscription.metadata).annona_account !== accountId) throw new Error("BILLING_TENANT_MISMATCH");
    const session = await this.request("POST", "billing_portal/sessions", {
      customer: id(subscription.customer),
      configuration: await this.portalConfiguration(),
      return_url: new URL("/settings/subscription", this.origin()).href,
    }, key);
    const url = str(session.url);
    if (new URL(url).protocol !== "https:" || new URL(url).hostname !== "billing.stripe.com") throw new Error("BILLING_PORTAL_URL_INVALID");
    return { url };
  }
}
