import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ROLE_PERMISSIONS } from "../prisma/reference-data";
import {
  SAAS_FEATURES,
  assertSaasFeature,
  assertSaasMutationFeature,
  assertSeatAvailable,
  orderUsageAlertPercent,
  recordOrderCreatedUsage,
  resolveCompanySaasAccess,
  utcMonthBounds,
} from "../src/domains/saas/saas.service";

type PlanCode = "STARTER" | "PRO" | "BUSINESS";

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
    includedDriverSeats: 0,
    unlimitedDriverSeats: true,
    maxDriverSeats: null,
    includedAdminSeats: 2,
    maxAdminSeats: null,
    includedDispatcherSeats: 1,
    maxDispatcherSeats: null,
    includedMonthlyOrders: 6000,
    orderOverageUnitPriceCents: 6,
    features: [...SAAS_FEATURES],
  },
} as const;

function commercial(
  code: PlanCode,
  options: {
    status?: string;
    end?: Date;
    cancelAtPeriodEnd?: boolean;
    items?: Array<{ kind: string; quantity: number; featureKey?: string }>;
  } = {}
) {
  const plan = planMatrix[code];
  return {
    id: `subscription-${code}`,
    kind: "COMMERCIAL",
    status: options.status ?? "ACTIVE",
    currentPeriodEnd: options.end ?? new Date("2026-12-01T00:00:00.000Z"),
    cancelAtPeriodEnd: options.cancelAtPeriodEnd ?? false,
    snapshot: {},
    planAssignments: [{
      snapshot: {
        schemaVersion: 1,
        planCode: code,
        planName: code,
        ...plan,
      },
    }],
    items: (options.items ?? []).map((item, index) => ({
      id: `item-${index}`,
      kind: item.kind,
      quantity: item.quantity,
      option: item.featureKey ? { featureKey: item.featureKey } : null,
    })),
  };
}

function database(subscription: Record<string, unknown>) {
  return {
    saasSubscription: { findUnique: async () => subscription },
  } as never;
}

test("SAAS-01A : matrice Starter/Pro/Business, dispatchers 0/1/1 et options cumulées", async () => {
  const starter = await resolveCompanySaasAccess("company-a", new Date("2026-10-21"), database(commercial("STARTER")));
  assert.deepEqual(starter.limits, { drivers: 5, admins: 1, dispatchers: 0, monthlyOrders: 1000 });
  assert.deepEqual([...starter.features], []);

  const pro = await resolveCompanySaasAccess("company-a", new Date("2026-10-21"), database(commercial("PRO", {
    items: [
      { kind: "DRIVER_SEAT", quantity: 4 },
      { kind: "DISPATCHER_SEAT", quantity: 2 },
      { kind: "OPTION", quantity: 1, featureKey: "client_gps" },
    ],
  })));
  assert.deepEqual(pro.limits, { drivers: 14, admins: 1, dispatchers: 3, monthlyOrders: 3000 });
  assert.deepEqual([...pro.features].sort(), ["admin_gps", "auto_dispatch", "client_gps"]);

  const business = await resolveCompanySaasAccess("company-a", new Date("2026-10-21"), database(commercial("BUSINESS")));
  assert.equal(business.limits.drivers, null);
  assert.equal(business.limits.dispatchers, 1);
  assert.deepEqual([...business.features].sort(), [...SAAS_FEATURES].sort());
});

test("SAAS-01A : pilote, échéance, impayé J14 et lecture seule restent distincts", async () => {
  const pilot = {
    id: "pilot-a",
    kind: "PILOT",
    status: "ACTIVE",
    currentPeriodEnd: new Date("2026-11-01T00:00:00.000Z"),
    cancelAtPeriodEnd: false,
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
  const active = await resolveCompanySaasAccess("company-a", new Date("2026-10-31T23:59:59Z"), database(pilot));
  assert.equal(active.kind, "PILOT");
  assert.equal(active.canCreateOrders, true);
  const expired = await resolveCompanySaasAccess("company-a", new Date("2026-11-01T00:00:00Z"), database(pilot));
  assert.equal(expired.status, "EXPIRED");
  assert.equal(expired.canMutate, false);

  const restricted = await resolveCompanySaasAccess("company-a", new Date("2026-10-21"), database(commercial("PRO", { status: "RESTRICTED" })));
  assert.equal(restricted.canMutate, true);
  assert.equal(restricted.canCreateOrders, false);
  const readOnly = await resolveCompanySaasAccess("company-a", new Date("2026-10-21"), database(commercial("PRO", { status: "READ_ONLY" })));
  assert.equal(readOnly.canMutate, false);
  assert.equal(readOnly.canCreateOrders, false);
});

test("SAAS-01A : les fonctions payantes sont refusées côté serveur", async () => {
  const starterDb = database(commercial("STARTER"));
  await assert.rejects(assertSaasFeature("company-a", "admin_gps", starterDb), /SAAS_FEATURE_NOT_AVAILABLE/);
  const optionDb = database(commercial("STARTER", {
    items: [{ kind: "OPTION", quantity: 1, featureKey: "admin_gps" }],
  }));
  await assert.doesNotReject(assertSaasFeature("company-a", "admin_gps", optionDb));

  const readOnlyDb = database(commercial("PRO", { status: "READ_ONLY" }));
  await assert.doesNotReject(assertSaasFeature("company-a", "admin_gps", readOnlyDb));
  await assert.rejects(
    assertSaasMutationFeature("company-a", "auto_dispatch", readOnlyDb),
    /SAAS_ACCOUNT_READ_ONLY/
  );
});

test("SAAS-01A : dernière place atomique, mois UTC et alertes 80/100/120", () => {
  assert.doesNotThrow(() => assertSeatAvailable(4, 0, 5, "drivers"));
  assert.throws(() => assertSeatAvailable(4, 1, 5, "drivers"), /SAAS_DRIVERS_LIMIT_REACHED/);
  assert.doesNotThrow(() => assertSeatAvailable(500, 20, null, "drivers"));
  const bounds = utcMonthBounds(new Date("2027-01-31T23:59:59.999Z"));
  assert.equal(bounds.startsAt.toISOString(), "2027-01-01T00:00:00.000Z");
  assert.equal(bounds.endsAt.toISOString(), "2027-02-01T00:00:00.000Z");
  assert.equal(orderUsageAlertPercent(799, 1000), null);
  assert.equal(orderUsageAlertPercent(800, 1000), 80);
  assert.equal(orderUsageAlertPercent(1000, 1000), 100);
  assert.equal(orderUsageAlertPercent(1200, 1000), 120);
});

test("SAAS-01A : une commande est comptée une seule fois et le dépassement ne la bloque pas", async () => {
  const subscription = commercial("STARTER") as any;
  subscription.planAssignments[0].snapshot.includedMonthlyOrders = 1;
  const events = new Map<string, Record<string, unknown>>();
  const periods = new Map<string, any>();
  const db = {
    saasSubscription: { findUnique: async () => subscription },
    saasUsageEvent: {
      findUnique: async ({ where }: any) => events.get(where.eventKey) ?? null,
      create: async ({ data }: any) => {
        const event = { id: `event-${events.size + 1}`, ...data };
        events.set(data.eventKey, event);
        return event;
      },
    },
    saasUsagePeriod: {
      // Comme `ON CONFLICT DO NOTHING` : une période déjà créée par une commande simultanée reste intacte.
      createMany: async ({ data, skipDuplicates }: any) => {
        assert.equal(skipDuplicates, true);
        for (const row of data) {
          const key = `${row.subscriptionId}:${row.startsAt.toISOString()}`;
          if (!periods.has(key)) periods.set(key, { id: `period-${periods.size + 1}`, orderCount: 0, overageCount: 0, ...row });
        }
        return { count: data.length };
      },
      findUniqueOrThrow: async ({ where }: any) =>
        periods.get(`${where.subscriptionId_startsAt.subscriptionId}:${where.subscriptionId_startsAt.startsAt.toISOString()}`),
    },
    $executeRaw: async (_strings: TemplateStringsArray, periodId: string) => {
      const period = [...periods.values()].find((candidate) => candidate.id === periodId);
      period.orderCount += 1;
      period.overageCount = Math.max(period.orderCount - period.includedOrders, 0);
      return 1;
    },
  } as never;

  const january = new Date("2027-01-31T23:59:59.000Z");
  await recordOrderCreatedUsage(db, { companyId: "company-a", orderId: "order-1", occurredAt: january });
  await recordOrderCreatedUsage(db, { companyId: "company-a", orderId: "order-1", occurredAt: january });
  await recordOrderCreatedUsage(db, { companyId: "company-a", orderId: "order-2", occurredAt: january });
  assert.equal(events.size, 2);
  assert.equal(periods.size, 1);
  assert.equal([...periods.values()][0].orderCount, 2);
  assert.equal([...periods.values()][0].overageCount, 1);

  const access = await resolveCompanySaasAccess("company-a", january, database(subscription));
  assert.equal(access.canCreateOrders, true);
  await recordOrderCreatedUsage(db, { companyId: "company-a", orderId: "order-3", occurredAt: new Date("2027-02-01T00:00:00Z") });
  assert.equal(periods.size, 2);
});

test("SAAS-01A : catalogue C7 versionné, annuel sans remise sur options et migration historique explicite", () => {
  const sql = readFileSync(resolve("prisma/migrations/20261021010000_saas_core/migration.sql"), "utf8");
  assert.match(sql, /'STARTER', 'Starter', 7900, 79000, 5, false, 10, 1, 1, 0/);
  assert.match(sql, /'PRO', 'Pro', 17900, 179000, 10, false, 30, 1, 1, 1/);
  assert.match(sql, /'BUSINESS', 'Business', 34900, 349000, 0, true, NULL, 2, NULL, 1/);
  assert.match(sql, /'DISPATCHER_ALL'.*800, 9600/);
  assert.match(sql, /'LEGACY', 'ACTIVE'/);
  assert.match(sql, /CREATE UNIQUE INDEX "saas_plan_assignments_one_current_key"/);
});

test("C8 : dispatch auto 29 € Starter, admin extra 12 € toutes offres, C7 retiré", () => {
  const sql = readFileSync(resolve("prisma/migrations/20261023180000_catalog_c8_prices/migration.sql"), "utf8");
  assert.match(sql, /C8-2026-10-23/);
  assert.match(sql, /"status" = 'RETIRED'/);
  assert.match(sql, /'STARTER', 'Starter', 7900, 79000, 5, false, 10, 1, NULL, 0/);
  assert.match(sql, /'AUTO_DISPATCH', 'Dispatch automatique', 'OPTION', 'auto_dispatch', NULL, 2900, 34800/);
  assert.match(sql, /'ADMIN_EXTRA', 'Administrateur supplémentaire', 'ADMIN_SEAT', NULL, 'COMPANY_ADMIN', 1200, 14400, ARRAY\['STARTER','PRO','BUSINESS'\]/);
  assert.match(sql, /'DISPATCHER_ALL'.*800, 9600/);
});

test("SAAS-01A : le dispatcher ne reçoit aucun droit de compte, facturation ou paramétrage", () => {
  const forbidden = new Set([
    "users:read", "users:create", "users:update", "users:delete",
    "invoices:read", "invoices:create", "invoices:update",
    "settings:read", "settings:update", "companies:update",
  ]);
  assert.equal(ROLE_PERMISSIONS.DISPATCHER.some((permission) => forbidden.has(permission)), false);
  assert.equal(ROLE_PERMISSIONS.DISPATCHER.includes("deliveries:dispatch"), true);
});
