import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  PREMIUM_DISCOVERY_DAYS,
  PREMIUM_DISCOVERY_FEATURES,
  premiumDiscoveryEndsAtForPaidSignup,
  resolveCompanySaasAccess,
} from "../src/domains/saas/saas.service";
import { buildSubscriptionView } from "../src/domains/billing/subscription-view.service";

type PlanCode = "STARTER" | "PRO" | "BUSINESS";

const DAY_MS = 86_400_000;
const planMatrix = {
  STARTER: {
    includedDriverSeats: 5,
    unlimitedDriverSeats: false,
    maxDriverSeats: 10,
    includedAdminSeats: 1,
    maxAdminSeats: 1,
    includedDispatcherSeats: 0,
    maxDispatcherSeats: null,
    includedMonthlyOrders: 1000,
    orderOverageUnitPriceCents: 10,
    features: [],
  },
  PRO: {
    includedDriverSeats: 10,
    unlimitedDriverSeats: false,
    maxDriverSeats: 30,
    includedAdminSeats: 1,
    maxAdminSeats: 1,
    includedDispatcherSeats: 1,
    maxDispatcherSeats: null,
    includedMonthlyOrders: 3000,
    orderOverageUnitPriceCents: 8,
    features: ["auto_dispatch", "admin_gps"],
  },
  BUSINESS: {
    includedDriverSeats: 20,
    unlimitedDriverSeats: false,
    maxDriverSeats: 50,
    includedAdminSeats: 2,
    maxAdminSeats: null,
    includedDispatcherSeats: 1,
    maxDispatcherSeats: null,
    includedMonthlyOrders: 6000,
    orderOverageUnitPriceCents: 6,
    features: [
      "auto_dispatch",
      "admin_gps",
      "client_gps",
      "advanced_analytics",
      "priority_support",
    ],
  },
} as const;

function commercial(input: {
  planCode: PlanCode;
  startsAt: Date;
  premiumDiscoveryEndsAt: Date | null;
  items?: Array<{ id: string; kind: "OPTION"; featureKey: string }>;
}) {
  const plan = planMatrix[input.planCode];
  return {
    id: `subscription-${input.planCode}`,
    kind: "COMMERCIAL",
    status: "ACTIVE",
    startsAt: input.startsAt,
    currentPeriodEnd: new Date("2027-01-01T00:00:00.000Z"),
    cancelAtPeriodEnd: false,
    premiumDiscoveryEndsAt: input.premiumDiscoveryEndsAt,
    snapshot: {},
    planAssignments: [{
      snapshot: {
        schemaVersion: 1,
        planCode: input.planCode,
        planName: input.planCode,
        ...plan,
      },
    }],
    items: (input.items ?? []).map((item) => ({
      id: item.id,
      kind: item.kind,
      quantity: 1,
      option: { featureKey: item.featureKey },
    })),
  };
}

function database(subscription: Record<string, unknown>) {
  return {
    saasSubscription: {
      findUnique: async () => subscription,
    },
  } as never;
}

function sortedFeatures(access: Awaited<ReturnType<typeof resolveCompanySaasAccess>>) {
  return [...access.features].sort();
}

function subscriptionAccount(planCode: PlanCode, premiumDiscoveryEndsAt: Date | null) {
  return {
    state: {
      activeContract: {
        quote: { planCode, planName: planCode, billingInterval: "MONTHLY" },
        lines: [{ code: `plan:${planCode}`, name: planCode, quantity: 1, unitHtCents: 7900 }],
      },
      status: "ACTIVE",
      cancelAtPeriodEnd: false,
      pendingChange: null,
      invoices: [],
    },
    subscription: {
      currentPeriodStart: new Date("2026-01-01T00:00:00.000Z"),
      currentPeriodEnd: new Date("2026-02-01T00:00:00.000Z"),
      status: "ACTIVE",
      billingInterval: "MONTHLY",
      cancelAtPeriodEnd: false,
      premiumDiscoveryEndsAt,
      usagePeriods: [],
    },
    operations: [],
  };
}

test("SAAS-04 : le faux paiement ouvre exactement 60 jours pour Starter/Pro", () => {
  const startsAt = new Date("2026-01-01T12:30:00.000Z");
  const expectedEnd = new Date(startsAt.getTime() + PREMIUM_DISCOVERY_DAYS * DAY_MS);

  for (const planCode of ["STARTER", "PRO"] as const) {
    assert.equal(
      premiumDiscoveryEndsAtForPaidSignup({ startsAt, planCode, paymentAdapter: "fake" })?.toISOString(),
      expectedEnd.toISOString()
    );
  }
  assert.equal(
    premiumDiscoveryEndsAtForPaidSignup({ startsAt, planCode: "BUSINESS", paymentAdapter: "fake" }),
    null
  );
  assert.equal(
    premiumDiscoveryEndsAtForPaidSignup({ startsAt, planCode: "STARTER", paymentAdapter: "stripe-sandbox" }),
    null
  );
  assert.equal(
    premiumDiscoveryEndsAtForPaidSignup({ startsAt, planCode: "PRO", paymentAdapter: null }),
    null
  );
  assert.throws(
    () => premiumDiscoveryEndsAtForPaidSignup({ startsAt: new Date("invalid"), planCode: "STARTER", paymentAdapter: "fake" }),
    /SAAS_DISCOVERY_START_INVALID/
  );

  const signupSource = readFileSync("src/domains/signup/signup.service.ts", "utf8");
  assert.match(signupSource, /paymentAdapterFromSnapshot\(confirmed\.snapshot\)/);
  assert.match(signupSource, /premiumDiscoveryEndsAtForPaidSignup/);
  assert.match(signupSource, /premiumDiscoveryEndsAt,/);
});

test("SAAS-04 : J0/J59/J60 gardent les quotas et l'option achetée sans supplément", async () => {
  const startsAt = new Date("2026-01-01T00:00:00.000Z");
  const endsAt = premiumDiscoveryEndsAtForPaidSignup({
    startsAt,
    planCode: "STARTER",
    paymentAdapter: "fake",
  })!;
  const subscription = commercial({
    planCode: "STARTER",
    startsAt,
    premiumDiscoveryEndsAt: endsAt,
    items: [{ id: "purchased-client-gps", kind: "OPTION", featureKey: "client_gps" }],
  });
  const db = database(subscription);
  const j0 = await resolveCompanySaasAccess("company-a", startsAt, db);
  const j59 = await resolveCompanySaasAccess(
    "company-a",
    new Date(startsAt.getTime() + 59 * DAY_MS),
    db
  );
  const j60 = await resolveCompanySaasAccess("company-a", endsAt, db);

  assert.deepEqual(sortedFeatures(j0), [...PREMIUM_DISCOVERY_FEATURES].sort());
  assert.deepEqual(sortedFeatures(j59), [...PREMIUM_DISCOVERY_FEATURES].sort());
  assert.deepEqual(sortedFeatures(j60), ["client_gps"]);
  assert.equal(j0.features.has("priority_support"), false);
  assert.equal(j59.features.has("priority_support"), false);
  assert.equal(j60.features.has("client_gps"), true);
  assert.equal(j0.premiumDiscovery?.endsAt.toISOString(), endsAt.toISOString());
  assert.deepEqual([...(j0.premiumDiscovery?.features ?? [])].sort(), [...PREMIUM_DISCOVERY_FEATURES].sort());
  assert.equal(j59.premiumDiscovery?.endsAt.toISOString(), endsAt.toISOString());
  assert.equal(j60.premiumDiscovery, null);
  for (const access of [j0, j59, j60]) {
    assert.deepEqual(access.limits, {
      drivers: 5,
      admins: 1,
      dispatchers: 0,
      monthlyOrders: 1000,
    });
  }
  assert.equal(subscription.items.length, 1);
});

test("SAAS-04 : la vue locale affiche la fin et les fonctions jusqu'à J59, puis les retire à J60", () => {
  const startsAt = new Date("2026-01-01T00:00:00.000Z");
  const endsAt = premiumDiscoveryEndsAtForPaidSignup({
    startsAt,
    planCode: "STARTER",
    paymentAdapter: "fake",
  })!;
  const account = subscriptionAccount("STARTER", endsAt);
  const j59 = buildSubscriptionView(account, new Date(startsAt.getTime() + 59 * DAY_MS));
  const j60 = buildSubscriptionView(account, endsAt);

  assert.equal(j59?.premiumDiscovery?.endsAt, endsAt.toISOString());
  assert.deepEqual(j59?.premiumDiscovery?.features, [
    { code: "auto_dispatch", name: "Dispatch automatique" },
    { code: "admin_gps", name: "Carte GPS administrateur" },
    { code: "client_gps", name: "Carte GPS client" },
    { code: "advanced_analytics", name: "Statistiques avancées" },
  ]);
  assert.equal(j60?.premiumDiscovery, null);
  assert.equal(
    buildSubscriptionView(subscriptionAccount("BUSINESS", endsAt), startsAt)?.premiumDiscovery,
    null
  );

  const serviceSource = readFileSync("src/domains/billing/subscription-view.service.ts", "utf8");
  assert.match(serviceSource, /premiumDiscoveryEndsAt: true/);
  const uiSource = readFileSync("src\/features\/back-office\/subscription-content.tsx", "utf8");
  assert.match(uiSource, /Découverte premium active/);
  assert.match(uiSource, /Vos quotas et votre facturation restent inchangés/);
});

test("SAAS-04 : fonctions incluses/achetées conservées, Business et pilote distincts", async () => {
  const startsAt = new Date("2026-01-01T00:00:00.000Z");
  const endsAt = premiumDiscoveryEndsAtForPaidSignup({
    startsAt,
    planCode: "PRO",
    paymentAdapter: "fake",
  })!;
  const pro = commercial({
    planCode: "PRO",
    startsAt,
    premiumDiscoveryEndsAt: endsAt,
    items: [{ id: "purchased-priority", kind: "OPTION", featureKey: "priority_support" }],
  });
  const proJ0 = await resolveCompanySaasAccess("company-pro", startsAt, database(pro));
  const proJ60 = await resolveCompanySaasAccess("company-pro", endsAt, database(pro));
  assert.deepEqual(sortedFeatures(proJ0), [
    "admin_gps",
    "advanced_analytics",
    "auto_dispatch",
    "client_gps",
    "priority_support",
  ]);
  assert.deepEqual(sortedFeatures(proJ60), ["admin_gps", "auto_dispatch", "priority_support"]);
  assert.deepEqual(proJ0.limits, proJ60.limits);
  assert.equal(pro.items.length, 1);

  const business = commercial({
    planCode: "BUSINESS",
    startsAt,
    premiumDiscoveryEndsAt: new Date("2027-01-01T00:00:00.000Z"),
  });
  const businessAccess = await resolveCompanySaasAccess("company-business", startsAt, database(business));
  assert.equal(businessAccess.premiumDiscovery, null);
  assert.equal(businessAccess.features.has("priority_support"), true);

  const pilot = {
    id: "pilot-a",
    kind: "PILOT",
    status: "ACTIVE",
    startsAt,
    currentPeriodEnd: new Date("2026-04-01T00:00:00.000Z"),
    cancelAtPeriodEnd: false,
    premiumDiscoveryEndsAt: new Date("2027-01-01T00:00:00.000Z"),
    snapshot: {
      schemaVersion: 1,
      mode: "PILOT",
      limits: { drivers: 3, admins: 1, dispatchers: 1, monthlyOrders: 50 },
      orderOverageUnitPriceCents: 0,
      features: ["admin_gps"],
    },
    planAssignments: [],
    items: [],
  };
  const pilotAccess = await resolveCompanySaasAccess("company-pilot", startsAt, database(pilot));
  assert.equal(pilotAccess.kind, "PILOT");
  assert.equal(pilotAccess.premiumDiscovery, null);
  assert.deepEqual(sortedFeatures(pilotAccess), ["admin_gps"]);
  assert.deepEqual(pilotAccess.limits, { drivers: 3, admins: 1, dispatchers: 1, monthlyOrders: 50 });
});
