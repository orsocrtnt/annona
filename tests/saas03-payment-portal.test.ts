import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildManagedSubscriptionView, buildSubscriptionView } from "../src/domains/billing/subscription-view.service";
import { loadBilling } from "./helpers/billing-loader";

const { stripe, service } = loadBilling();
const env: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  SIGNUP_PAYMENT_ADAPTER: "stripe-sandbox",
  STRIPE_SECRET_KEY: "sk_test_unit_only",
  STRIPE_WEBHOOK_SECRET: "whsec_unit_only",
  NEXT_PUBLIC_APP_URL: "https://preprod.example.invalid",
};
// Les modules chargés dans un contexte vm ont leurs propres prototypes : on compare des valeurs JSON.
const plain = (value: unknown) => JSON.parse(JSON.stringify(value)) as unknown;
type Call = { method: string; path: string; body: URLSearchParams | null; key: string | undefined };

function fakeStripe(options: { configurations?: unknown[]; sessionUrl?: string; account?: string } = {}) {
  const calls: Call[] = [];
  const fetcher = async (url: string | URL | Request, init?: RequestInit) => {
    const parsed = new URL(String(url));
    const headers = init?.headers as Record<string, string>;
    calls.push({ method: init?.method ?? "GET", path: parsed.pathname, body: init?.body ? new URLSearchParams(String(init.body)) : null, key: headers["Idempotency-Key"] });
    if (parsed.pathname === "/v1/subscriptions/sub_test") {
      return Response.json({ id: "sub_test", livemode: false, customer: "cus_test", metadata: { tutelliv_account: options.account ?? "account" } });
    }
    if (parsed.pathname === "/v1/billing_portal/configurations" && init?.method === "GET") {
      return Response.json({ data: options.configurations ?? [], has_more: false });
    }
    if (parsed.pathname === "/v1/billing_portal/configurations") return Response.json({ id: "bpc_created", livemode: false });
    if (parsed.pathname === "/v1/billing_portal/sessions") {
      return Response.json({ id: "bps_test", livemode: false, url: options.sessionUrl ?? "https://billing.stripe.com/p/session/test_unit" });
    }
    return new Response(null, { status: 404 });
  };
  return { calls, provider: new stripe.StripeSandboxProvider(fetcher as typeof fetch, env) };
}

test("SAAS-03 : le portail Stripe se limite au moyen de paiement et aux factures, configuration créée une seule fois", async () => {
  const { calls, provider } = fakeStripe();
  const result = await provider.paymentPortal("sub_test", "account", "portal:key-1");
  assert.deepEqual(plain(result), { url: "https://billing.stripe.com/p/session/test_unit" });

  const created = calls.find((call) => call.method === "POST" && call.path === "/v1/billing_portal/configurations")!;
  assert.equal(created.key, `tutelliv:portal-configuration:${stripe.PAYMENT_PORTAL_CONFIGURATION}`);
  assert.equal(created.body?.get("features[payment_method_update][enabled]"), "true");
  assert.equal(created.body?.get("features[invoice_history][enabled]"), "true");
  for (const feature of ["subscription_cancel", "subscription_update", "customer_update"]) {
    assert.equal(created.body?.get(`features[${feature}][enabled]`), "false", `${feature} reste géré par TutelLiv`);
  }
  assert.equal(created.body?.get("metadata[tutelliv_portal]"), stripe.PAYMENT_PORTAL_CONFIGURATION);

  const session = calls.find((call) => call.path === "/v1/billing_portal/sessions")!;
  assert.equal(session.key, "portal:key-1");
  assert.equal(session.body?.get("customer"), "cus_test");
  assert.equal(session.body?.get("configuration"), "bpc_created");
  assert.equal(session.body?.get("return_url"), "https://preprod.example.invalid/settings/subscription");

  const reused = fakeStripe({ configurations: [
    { id: "bpc_other", metadata: { tutelliv_portal: "autre" } },
    { id: "bpc_existing", metadata: { tutelliv_portal: stripe.PAYMENT_PORTAL_CONFIGURATION } },
  ] });
  await reused.provider.paymentPortal("sub_test", "account", "portal:key-2");
  assert.equal(reused.calls.some((call) => call.method === "POST" && call.path === "/v1/billing_portal/configurations"), false, "pas de doublon au-delà des 24 h d'idempotence");
  assert.equal(reused.calls.find((call) => call.path === "/v1/billing_portal/sessions")?.body?.get("configuration"), "bpc_existing");
});

test("SAAS-03 : portail refusé pour une autre entreprise ou une adresse hors Stripe", async () => {
  const foreign = fakeStripe({ account: "another" });
  await assert.rejects(foreign.provider.paymentPortal("sub_test", "account", "portal:key"), /BILLING_TENANT_MISMATCH/);
  assert.equal(foreign.calls.some((call) => call.path === "/v1/billing_portal/sessions"), false, "aucune session pour un abonnement étranger");

  for (const sessionUrl of ["https://evil.example/p/session", "http://billing.stripe.com/p/session", "https://billing.stripe.com.evil.example/x"]) {
    await assert.rejects(fakeStripe({ sessionUrl }).provider.paymentPortal("sub_test", "account", "portal:key"), /BILLING_PORTAL_URL_INVALID/);
  }
});

function fakeDb(state: Record<string, unknown>, providerSubscriptionId: string | null = "sub_test") {
  const operations = new Map<string, Record<string, unknown>>();
  return {
    operations,
    db: {
      saasBillingAccount: { findUniqueOrThrow: async () => ({ id: "account", providerSubscriptionId, state }) },
      saasBillingOperation: {
        create: async ({ data }: { data: Record<string, unknown> }) => { operations.set(String(data.id), { status: "PREPARED", ...data }); return data; },
        update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => { operations.set(where.id, { ...operations.get(where.id), ...data }); return data; },
      },
    },
  };
}
const activeState = { status: "PAST_DUE", activeContract: { hash: "contract" } };

test("SAAS-03 : chaque ouverture du portail est journalisée avec son auteur, jamais avec le lien", async () => {
  const { db, operations } = fakeDb(activeState);
  const keys: string[] = [];
  const billing = new service.BillingService({
    paymentPortal: async (subscriptionId: string, accountId: string, key: string) => {
      assert.deepEqual([subscriptionId, accountId], ["sub_test", "account"]);
      keys.push(key);
      return { url: "https://billing.stripe.com/p/session/secret_link" };
    },
  } as never, db as never);

  assert.deepEqual(plain(await billing.paymentPortal("account", "admin-1")), { url: "https://billing.stripe.com/p/session/secret_link" });
  const [operation] = [...operations.values()];
  assert.equal(operation?.kind, "PAYMENT_PORTAL");
  assert.equal(operation?.status, "DONE");
  assert.equal(operation?.id, keys[0], "la clé fournisseur est l'identifiant journalisé");
  assert.deepEqual(plain(operation?.input), { command: { kind: "PAYMENT_PORTAL", actorId: "admin-1" } });
  assert.doesNotMatch(JSON.stringify(operation), /billing\.stripe\.com|secret_link/);

  await billing.paymentPortal("account", "admin-1");
  assert.equal(new Set(keys).size, 2, "chaque ouverture a sa propre session");
});

test("SAAS-03 : portail refusé sans abonnement actif, échec fournisseur journalisé sans détail", async () => {
  for (const [state, subscription] of [[{ status: "CANCELLED", activeContract: { hash: "c" } }, "sub_test"], [{ status: "PENDING_PAYMENT", activeContract: null }, "sub_test"], [activeState, null]] as const) {
    const { db, operations } = fakeDb(state, subscription);
    const billing = new service.BillingService({ paymentPortal: async () => assert.fail("aucun appel fournisseur") } as never, db as never);
    await assert.rejects(billing.paymentPortal("account", "admin-1"), /BILLING_NOT_ACTIVE/);
    assert.equal(operations.size, 0);
  }
  const { db, operations } = fakeDb(activeState);
  const billing = new service.BillingService({ paymentPortal: async () => { throw new Error("https://api.stripe.com secret detail"); } } as never, db as never);
  await assert.rejects(billing.paymentPortal("account", "admin-1"), /^Error: BILLING_PROVIDER_UNAVAILABLE$/);
  const [operation] = [...operations.values()];
  assert.equal(operation?.status, "FAILED");
  assert.deepEqual(plain(operation?.result), { code: "BILLING_PROVIDER_UNAVAILABLE" });
});

function account(status: string, invoices: unknown[]) {
  return {
    state: {
      activeContract: { quote: { planCode: "PRO", planName: "Pro", billingInterval: "MONTHLY" }, lines: [] },
      status,
      cancelAtPeriodEnd: false,
      pendingChange: null,
      invoices,
    },
    subscription: {
      currentPeriodStart: new Date("2026-10-01T00:00:00.000Z"),
      currentPeriodEnd: new Date("2026-11-01T00:00:00.000Z"),
      status,
      billingInterval: "MONTHLY",
      cancelAtPeriodEnd: false,
      premiumDiscoveryEndsAt: null,
      usagePeriods: [],
    },
    operations: [{ id: "op", kind: "PAYMENT_PORTAL", status: "DONE", createdAt: new Date("2026-10-21T00:00:00.000Z"), completedAt: new Date("2026-10-21T00:00:00.000Z") }],
  };
}
const invoice = (id: string, documentUrl: unknown) => ({ id, reason: "subscription_cycle", status: "open", dueAt: "2026-10-20T00:00:00.000Z", totalCents: 21480, documentUrl });

test("SAAS-03 : seules les factures hébergées par Stripe ouvrent un document, et le portail suit l'état", () => {
  const view = buildSubscriptionView(account("PAST_DUE", [
    invoice("in_ok", "https://invoice.stripe.com/i/acct_test/test_unit"),
    invoice("in_http", "http://invoice.stripe.com/i/acct_test/x"),
    invoice("in_host", "https://invoice.stripe.com.evil.example/i/x"),
    invoice("in_creds", "https://user:pass@invoice.stripe.com/i/x"),
    invoice("in_none", null),
    invoice("in_js", "javascript:alert(1)"),
  ]) as never)!;
  const documents = view.history.filter((entry) => entry.type === "invoice").map((entry) => entry.documentUrl);
  assert.deepEqual(documents.filter(Boolean), ["https://invoice.stripe.com/i/acct_test/test_unit"]);
  assert.equal(documents.length, 6);
  assert.ok(view.history.some((entry) => entry.label === "Accès au moyen de paiement" && entry.status === "Terminée"));
  assert.equal(view.canManagePaymentMethod, true, "un impayé peut être réglé en changeant de carte");

  assert.equal(buildSubscriptionView(account("CANCELLED", []) as never)!.canManagePaymentMethod, false);
  const managed = buildManagedSubscriptionView({
    kind: "COMMERCIAL",
    status: "ACTIVE",
    billingInterval: "ANNUAL",
    currentPeriodStart: new Date("2026-10-01T00:00:00.000Z"),
    currentPeriodEnd: new Date("2027-10-01T00:00:00.000Z"),
    cancelAtPeriodEnd: false,
    premiumDiscoveryEndsAt: null,
    planAssignments: [{ plan: { code: "STARTER", name: "Starter", includedMonthlyOrders: 1000 } }],
    items: [],
    usagePeriods: [],
  } as never);
  assert.equal(managed?.canManagePaymentMethod, false, "abonnement géré par l'équipe : aucune action en ligne");
});

test("SAAS-03 : la route réserve le portail au compte en ligne de l'entreprise et l'écran ne garde pas le lien", () => {
  const route = readFileSync(resolve("src/app/api/billing/route.ts"), "utf8");
  assert.match(route, /z\.object\(\{ action: z\.literal\("portal"\) \}\)\.strict\(\)/);
  assert.match(route, /requireRole\(auth\.context, \["COMPANY_ADMIN"\]\)/);
  assert.match(route, /billing\.paymentPortal\(auth\.account\.id, auth\.actorId\)/);
  const ui = readFileSync(resolve("src/features/back-office/subscription-payment-method.tsx"), "utf8");
  assert.match(ui, /window\.location\.assign\(url\)/);
  assert.doesNotMatch(ui, /localStorage|sessionStorage/);
  const content = readFileSync(resolve("src/features/back-office/subscription-content.tsx"), "utf8");
  assert.match(content, /rel="noopener noreferrer"/);
});
