import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server";
import {
  commercialSubscriptionSelect,
  commercialSubscriptionWhere,
  listCommercialSubscriptions,
  parseSubscriptionListParams,
  toCommercialSubscriptionRow,
  type SubscriptionListParams,
} from "../src/domains/admin/subscriptions.service";

const now = new Date("2026-10-25T12:00:00.000Z");

function load(file: string, dependencies: Record<string, unknown>) {
  const module = { exports: {} as Record<string, (...args: never[]) => Promise<unknown>> };
  const source = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  runInNewContext(source, {
    Error,
    Date,
    URL,
    exports: module.exports,
    module,
    require: (id: string) => {
      assert.ok(id in dependencies, `Unexpected dependency ${id}`);
      return dependencies[id];
    },
  });
  return module.exports;
}

test("ADMIN-1 : paramètres stricts, pagination et fenêtre effective", async () => {
  assert.deepEqual(parseSubscriptionListParams(new URLSearchParams()), { query: { page: 1, pageSize: 25 } });
  assert.ok("error" in parseSubscriptionListParams(new URLSearchParams("pageSize=10")));
  assert.ok("error" in parseSubscriptionListParams(new URLSearchParams("page=0")));
  assert.equal(
    (parseSubscriptionListParams(new URLSearchParams(`page=${"9".repeat(400)}`)) as { error: string }).error,
    "Page invalide"
  );
  assert.equal(
    (parseSubscriptionListParams(new URLSearchParams("page=90071992547411&pageSize=100")) as { error: string }).error,
    "Page invalide"
  );
  assert.ok("error" in parseSubscriptionListParams(new URLSearchParams("status=TRIAL")));
  assert.ok("error" in parseSubscriptionListParams(new URLSearchParams("secret=1")));

  const parsed = parseSubscriptionListParams(new URLSearchParams("q=  Acme  &status=ACTIVE&plan=BUSINESS&page=2&pageSize=50"));
  assert.ok("query" in parsed);
  const query = { ...parsed.query, now };
  const calls: Array<{ op: string; args: Record<string, unknown> }> = [];
  const db = {
    saasSubscription: {
      count: async (args: { where: { status?: string | { in?: string[] } } }) => {
        calls.push({ op: "count", args });
        const status = args.where.status;
        if (status === "ACTIVE") return 4;
        if (status === "CANCEL_AT_PERIOD_END") return 1;
        if (typeof status === "object" && status.in?.includes("PAST_DUE")) return 2;
        if (typeof status === "object" && status.in?.includes("CANCELLED")) return 3;
        return 60;
      },
      findMany: async (args: Record<string, unknown>) => {
        calls.push({ op: "findMany", args });
        return [{
          id: "sub-business",
          status: "ACTIVE" as const,
          billingInterval: "ANNUAL" as const,
          currentPeriodStart: new Date("2026-10-01T00:00:00.000Z"),
          currentPeriodEnd: new Date("2026-11-01T00:00:00.000Z"),
          cancelAtPeriodEnd: false,
          endedAt: null,
          company: { id: "company-acme", name: "Acme", email: "contact@acme.fr", phone: "0102030405" },
          planAssignments: [{ plan: { code: "BUSINESS" as const, name: "Business", monthlyPriceCents: 34900, annualPriceCents: 349000 } }],
          items: [
            { code: "AUTO_DISPATCH", kind: "OPTION" as const, quantity: 1, unitPriceCents: 0 },
            { code: "AUTO_DISPATCH", kind: "OPTION" as const, quantity: 1, unitPriceCents: 0 },
            { code: "DRIVER_BUSINESS", kind: "DRIVER_SEAT" as const, quantity: 5, unitPriceCents: 900 },
            { code: "ADMIN", kind: "ADMIN_SEAT" as const, quantity: 1, unitPriceCents: 1200 },
            { code: "DISPATCH", kind: "DISPATCHER_SEAT" as const, quantity: 2, unitPriceCents: 800 },
          ],
          usagePeriods: [{ includedOrders: 6000, orderCount: 8000, overageCount: 2000 }],
        }];
      },
    },
  };

  const page = await listCommercialSubscriptions(query as SubscriptionListParams, db);
  assert.deepEqual(calls.map((call) => call.op), ["count", "findMany", "count", "count", "count", "count"]);
  assert.equal(Object.keys(db.saasSubscription).join(), "count,findMany");
  const findMany = calls[1]?.args;
  assert.ok(findMany);
  assert.deepEqual(findMany.orderBy, [{ updatedAt: "desc" }, { id: "desc" }]);
  assert.equal(findMany.skip, 50);
  assert.equal(findMany.take, 50);
  assert.equal((findMany.where as { kind: string }).kind, "COMMERCIAL");
  assert.deepEqual(commercialSubscriptionWhere(query as SubscriptionListParams, now).planAssignments, {
    some: {
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
      plan: { code: "BUSINESS" },
    },
  });
  const select = commercialSubscriptionSelect(now);
  assert.equal("snapshot" in select, false);
  assert.equal("providerCustomerId" in select, false);
  assert.equal("providerSubscriptionId" in select, false);
  const row = page.rows[0];
  assert.ok(row);
  assert.deepEqual(row.quantities, {
    options: [{ code: "AUTO_DISPATCH", quantity: 2 }],
    seats: { DRIVER_SEAT: 5, ADMIN_SEAT: 1, DISPATCHER_SEAT: 2 },
  });
  assert.deepEqual(row.orders, { consumed: 8000, included: 6000, overage: 2000 });
  assert.equal(row.usageAlertPercent, 120);
  assert.equal(row.companyId, "company-acme");
  assert.equal(row.email, "contact@acme.fr");
  assert.equal(row.followUp, "CURRENT");
  assert.equal(row.amountCents, 349000 + 5 * 900 + 1200 + 2 * 800);
  assert.deepEqual(page.summary, { current: 4, remind: 2, ending: 1, stopped: 3 });
  assert.equal("blocked" in row, false);
  assert.equal("maxDriverSeats" in row, false);
  assert.equal(JSON.stringify(page).includes("provider"), false);
});

test("ADMIN-1 : une ligne Business reprend les compteurs enregistrés, sans plafond ajouté", () => {
  const row = toCommercialSubscriptionRow({
    id: "sub-business",
    status: "ACTIVE",
    billingInterval: "MONTHLY",
    currentPeriodStart: now,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    endedAt: null,
    company: { id: "company-business", name: "Business SAS", email: null, phone: null },
    planAssignments: [{ plan: { code: "BUSINESS", name: "Business", monthlyPriceCents: 34900, annualPriceCents: 349000 } }],
    items: [{ code: "DRIVER_BUSINESS", kind: "DRIVER_SEAT", quantity: -3, unitPriceCents: 900 }],
    usagePeriods: [
      { includedOrders: 6000, orderCount: 1000, overageCount: 0 },
      { includedOrders: 0, orderCount: 50, overageCount: 50 },
    ],
  });
  assert.equal(row.plan, "BUSINESS");
  assert.equal(row.periodEnd, null);
  assert.equal(row.quantities.seats.DRIVER_SEAT, 0);
  assert.deepEqual(row.orders, { consumed: 1050, included: 6000, overage: 50 });
  assert.equal(row.usageAlertPercent, null);
  assert.equal("maxDriverSeats" in row, false);
});

test("ADMIN-1 : alerte de consommation 79, 80, 100, 120 et volume inclus nul", () => {
  function alertFor(consumed: number, included: number) {
    return toCommercialSubscriptionRow({
      id: "sub-alert",
      status: "ACTIVE",
      billingInterval: "MONTHLY",
      currentPeriodStart: now,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      endedAt: null,
      company: { id: "company-alert", name: "Alerte SAS", email: null, phone: null },
      planAssignments: [{ plan: { code: "STARTER", name: "Starter", monthlyPriceCents: 7900, annualPriceCents: 79000 } }],
      items: [],
      usagePeriods: [{ includedOrders: included, orderCount: consumed, overageCount: 0 }],
    }).usageAlertPercent;
  }
  assert.equal(alertFor(79, 100), null);
  assert.equal(alertFor(80, 100), 80);
  assert.equal(alertFor(100, 100), 100);
  assert.equal(alertFor(120, 100), 120);
  assert.equal(alertFor(10, 0), null);
  const screen = readFileSync("src/app/(back-office)/admin/subscriptions/page.tsx", "utf8");
  for (const label of ["Sous 80 %", "80 %", "100 %", "120 % ou plus", "—", "À jour", "À relancer", "Résiliation en cours", "Ne paie plus", "HT enregistré"]) {
    assert.equal(screen.includes(label), true, label);
  }
});

test("ADMIN-1 : la route refuse sans dashboard:admin, valide, et n'écrit pas", async () => {
  let allowed = false;
  const writes: string[] = [];
  const route = load("src/app/api/admin/subscriptions/route.ts", {
    "next/server": { NextResponse },
    "@/lib/api/auth-guard": {
      requireStaffRole: async (permission: string) => {
        assert.equal(permission, "dashboard:admin");
        return allowed ? { context: { user: { id: "staff" } } } : { error: NextResponse.json({ error: "Accès refusé" }, { status: 403 }) };
      },
      requireRole: () => null,
    },
    "@/lib/api/platform-access": { gatePlatformRead: async (_context: unknown, denied: Response | null) => denied },
    "@/domains/admin/subscriptions.service": {
      parseSubscriptionListParams,
      listCommercialSubscriptions: async () => {
        writes.push("read");
        return { page: 1, pageSize: 25, total: 0, rows: [] };
      },
      createSubscription: async () => writes.push("write"),
    },
  });
  const get = route.GET as unknown as (request: Request) => Promise<Response>;
  const denied = await get(new Request("http://localhost/api/admin/subscriptions"));
  assert.equal(denied.status, 403);
  assert.equal(writes.length, 0);

  allowed = true;
  const invalid = await get(new Request("http://localhost/api/admin/subscriptions?pageSize=10"));
  assert.equal(invalid.status, 400);
  assert.equal(writes.length, 0);

  const ok = await get(new Request("http://localhost/api/admin/subscriptions"));
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("cache-control"), "no-store");
  assert.deepEqual(writes, ["read"]);
});
