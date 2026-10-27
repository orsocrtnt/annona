import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildSaasHealthIndicators,
  companyUsageAlerts,
  getSaasHealthIndicators,
  saasHealthMonth,
  type SaasHealthSources,
} from "../src/domains/admin/saas-health.service";

const at = new Date("2026-10-25T12:00:00.000Z");

function sources(): SaasHealthSources {
  return {
    billingAccounts: [{
      id: "billing-pro",
      state: {
        invoices: [
          { id: "invoice-pro", status: "paid", currency: "EUR", subtotalCents: 17_900, totalCents: 21_480, paidCents: 21_480, refundedCents: 0, dueAt: "2026-10-03T00:00:00.000Z", reason: "subscription_cycle" },
          { id: "invoice-usage", status: "paid", currency: "EUR", subtotalCents: 1_000, totalCents: 1_200, paidCents: 1_200, refundedCents: 0, dueAt: "2026-10-20T00:00:00.000Z", reason: "usage" },
          { id: "invoice-open", status: "open", currency: "EUR", subtotalCents: 17_900, totalCents: 21_480, paidCents: 0, refundedCents: 0, dueAt: "2026-10-25T00:00:00.000Z", reason: "subscription_cycle" },
          { id: "invoice-old-refund", status: "paid", currency: "EUR", subtotalCents: 17_900, totalCents: 21_480, paidCents: 21_480, refundedCents: 1_200, dueAt: "2026-09-03T00:00:00.000Z", reason: "subscription_cycle" },
        ],
      },
    }],
    fakeSignups: [
      {
        id: "signup-fake",
        quoteSnapshot: { totalHtCents: 7_900, totalTtcCents: 9_480 },
        billingAccount: null,
        paymentEvents: [
          { eventKey: "fake-first", status: "CONFIRMED", amountCents: 9_480, currency: "EUR", snapshot: { adapter: "fake" }, receivedAt: new Date("2026-10-02T00:00:00.000Z") },
          { eventKey: "fake-replay", status: "CONFIRMED", amountCents: 9_480, currency: "EUR", snapshot: { adapter: "fake" }, receivedAt: new Date("2026-10-04T00:00:00.000Z") },
        ],
      },
      {
        id: "signup-backed-by-billing",
        quoteSnapshot: { totalHtCents: 17_900, totalTtcCents: 21_480 },
        billingAccount: { id: "billing-pro" },
        paymentEvents: [
          { eventKey: "stripe-event", status: "CONFIRMED", amountCents: 21_480, currency: "EUR", snapshot: { adapter: "stripe-sandbox" }, receivedAt: new Date("2026-10-03T00:00:00.000Z") },
        ],
      },
      {
        id: "signup-replayed-in-october",
        quoteSnapshot: { totalHtCents: 7_900, totalTtcCents: 9_480 },
        billingAccount: null,
        paymentEvents: [
          { eventKey: "fake-september", status: "CONFIRMED", amountCents: 9_480, currency: "EUR", snapshot: { adapter: "fake" }, receivedAt: new Date("2026-09-30T23:00:00.000Z") },
          { eventKey: "fake-october-replay", status: "CONFIRMED", amountCents: 9_480, currency: "EUR", snapshot: { adapter: "fake" }, receivedAt: new Date("2026-10-01T01:00:00.000Z") },
        ],
      },
    ],
    subscriptions: [
      {
        id: "subscription-starter",
        kind: "COMMERCIAL",
        status: "ACTIVE",
        startsAt: new Date("2026-10-02T00:00:00.000Z"),
        company: { id: "company-starter", name: "Starter SARL", users: Array.from({ length: 5 }, (_, index) => ({ id: `starter-driver-${index}` })) },
        planAssignments: [{ snapshot: { planCode: "STARTER" } }],
        items: [{ code: "AUTO_DISPATCH", kind: "OPTION", quantity: 1 }, { code: "DRIVER_STARTER", kind: "DRIVER_SEAT", quantity: 1 }],
        usagePeriods: [{ includedOrders: 1_000, orderCount: 1_200, overageCount: 200 }],
      },
      {
        id: "subscription-business",
        kind: "COMMERCIAL",
        status: "ACTIVE",
        startsAt: new Date("2026-09-01T00:00:00.000Z"),
        company: { id: "company-business", name: "Business SAS", users: Array.from({ length: 25 }, (_, index) => ({ id: `business-driver-${index}` })) },
        planAssignments: [{ snapshot: { planCode: "BUSINESS" } }],
        items: [{ code: "DRIVER_BUSINESS", kind: "DRIVER_SEAT", quantity: 5 }],
        usagePeriods: [{ includedOrders: 6_000, orderCount: 8_000, overageCount: 2_000 }],
      },
      {
        id: "pilot-excluded",
        kind: "PILOT",
        status: "ACTIVE",
        startsAt: new Date("2026-10-01T00:00:00.000Z"),
        company: { id: "company-pilot", name: "Pilote", users: [{ id: "pilot-driver" }] },
        planAssignments: [],
        items: [],
        usagePeriods: [{ includedOrders: 50, orderCount: 50, overageCount: 0 }],
      },
    ],
  };
}

test("SAAS-02 : revenu SaaS HT séparé, activation et faux paiement dédupliqué", () => {
  const result = buildSaasHealthIndicators(sources(), at);
  assert.deepEqual(result.period, {
    startsAt: "2026-10-01T00:00:00.000Z",
    endsAt: "2026-11-01T00:00:00.000Z",
    timezone: "UTC",
  });
  assert.equal(result.revenue.subscriptionPaidHtCents, 25_800);
  assert.equal(result.revenue.usagePaidHtCents, 1_000);
  assert.equal(result.revenue.ignoredRecords, 1);
  assert.equal(result.revenue.refundedInvoicesObserved, 1);
  assert.deepEqual(result.activation, { commercialSubscriptions: 2, newSubscriptions: 1 });
  assert.ok(result.definitions.some((definition) => definition.includes("Factures de livraison")));
  assert.ok(result.definitions.some((definition) => definition.includes("Remboursements non déduits")));
});

test("SAAS-02 : commandes, livreurs et options sont mesurés par formule, Business compris", () => {
  const result = buildSaasHealthIndicators(sources(), at);
  assert.deepEqual(result.consumption, {
    orders: 9_200,
    includedOrders: 7_000,
    overageOrders: 2_200,
    drivers: 30,
    activeOptionUnits: 7,
  });
  assert.deepEqual(result.byPlan.find((plan) => plan.planCode === "BUSINESS"), {
    planCode: "BUSINESS",
    subscriptions: 1,
    activations: 0,
    orders: 8_000,
    includedOrders: 6_000,
    overageOrders: 2_000,
    drivers: 25,
    activeOptionUnits: 5,
  });
  assert.equal(result.byPlan.find((plan) => plan.planCode === "PRO")?.orders, 0);
  assert.equal(result.companies.length, 2);
  assert.ok(result.companies.every((company) => company.name !== "Pilote"));
});

test("SAAS-02 : bornes mensuelles UTC et écritures incomplètes ne produisent aucun chiffre", () => {
  assert.deepEqual(saasHealthMonth(new Date("2026-12-31T23:59:59.999Z")), {
    startsAt: new Date("2026-12-01T00:00:00.000Z"),
    endsAt: new Date("2027-01-01T00:00:00.000Z"),
  });
  const input = sources();
  input.billingAccounts[0]!.state = { invoices: [{ id: "broken", status: "paid", dueAt: "invalid" }] };
  input.fakeSignups[0]!.paymentEvents[0]!.amountCents = 1;
  const result = buildSaasHealthIndicators(input, at);
  assert.equal(result.revenue.subscriptionPaidHtCents, 0);
  assert.equal(result.revenue.usagePaidHtCents, 0);
  assert.equal(result.revenue.ignoredRecords, 2);
});

test("SAAS-02 : le lecteur Prisma reste borné aux requêtes de lecture et l'API est sans cache", async () => {
  const calls: Array<{ model: string; input: unknown }> = [];
  const db = {
    saasBillingAccount: { findMany: async (input: unknown) => { calls.push({ model: "billing", input }); return []; } },
    signupJourney: { findMany: async (input: unknown) => { calls.push({ model: "signup", input }); return []; } },
    saasSubscription: { findMany: async (input: unknown) => { calls.push({ model: "subscription", input }); return []; } },
  };
  const result = await getSaasHealthIndicators(at, db as never);
  assert.equal(calls.length, 3);
  assert.deepEqual(calls.map((call) => call.model).sort(), ["billing", "signup", "subscription"]);
  assert.equal(result.revenue.subscriptionPaidHtCents, 0);
  assert.equal(result.byPlan.length, 3);

  const route = readFileSync("src/app/api/admin/overview/route.ts", "utf8");
  assert.match(route, /Cache-Control.*no-store/);
  const platform = readFileSync("src/domains/admin/platform.service.ts", "utf8");
  assert.match(platform, /paidDeliveryInvoiceRevenue/);
  assert.equal(platform.includes("getSaasHealthIndicators"), false);
  const healthRoute = readFileSync("src/app/api/admin/saas-health/route.ts", "utf8");
  assert.match(healthRoute, /getSaasHealthIndicators/);
  assert.match(healthRoute, /Cache-Control.*no-store/);
});

test("SAAS-02 (C10) : alertes 80/100/120 % et seuils Business, une seule par nature, pilotes exclus", () => {
  const indicators = buildSaasHealthIndicators(sources(), at);
  assert.deepEqual(
    indicators.alerts.map(({ companyId, kind, value, threshold }) => ({ companyId, kind, value, threshold })),
    [
      { companyId: "company-business", kind: "ORDERS_120", value: 8_000, threshold: 7_200 },
      { companyId: "company-starter", kind: "ORDERS_120", value: 1_200, threshold: 1_200 },
    ],
    "Starter à 120 % pile ; Business à 133 % mais sous deux fois l'inclus et sous 40 livreurs"
  );
  assert.equal(indicators.alerts.some((alert) => alert.companyId === "company-pilot"), false);
  assert.match(indicators.definitions.join(" "), /Alertes \(décision C10\)/);

  const company = { companyId: "c", name: "Société", drivers: 0 };
  assert.deepEqual(companyUsageAlerts({ ...company, planCode: "PRO", orders: 799, includedOrders: 1_000 }), []);
  assert.equal(companyUsageAlerts({ ...company, planCode: "PRO", orders: 800, includedOrders: 1_000 })[0]?.kind, "ORDERS_80");
  assert.equal(companyUsageAlerts({ ...company, planCode: "PRO", orders: 1_000, includedOrders: 1_000 })[0]?.kind, "ORDERS_100");
  assert.deepEqual(companyUsageAlerts({ ...company, planCode: "STARTER", orders: 5, includedOrders: 0 }), [], "sans période mesurée, aucune fausse alerte");
  assert.deepEqual(
    companyUsageAlerts({ ...company, planCode: "BUSINESS", orders: 12_000, includedOrders: 6_000, drivers: 40 }).map((alert) => alert.kind),
    ["ORDERS_120", "BUSINESS_ORDERS_DOUBLE", "BUSINESS_DRIVERS_40"]
  );
  assert.deepEqual(
    companyUsageAlerts({ ...company, planCode: "PRO", orders: 12_000, includedOrders: 6_000, drivers: 45 }).map((alert) => alert.kind),
    ["ORDERS_120"],
    "les seuils Business ne visent que Business"
  );
  assert.deepEqual(
    companyUsageAlerts({ ...company, planCode: "BUSINESS", orders: 11_999, includedOrders: 6_000, drivers: 39 }).map((alert) => alert.kind),
    ["ORDERS_120"]
  );
});
