import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import {
  addRecurringInterval,
  parseRecurringCalendarDate,
  recurringCalendarDateValue,
} from "../src/lib/order/recurrence-schedule";

type Recurring = {
  id: string;
  status: "ACTIVE" | "PAUSED" | "CANCELLED";
  startAt: Date;
  nextRunAt: Date;
  endAt: Date | null;
  intervalValue: number;
  intervalUnit: "DAYS" | "WEEKS" | "MONTHS";
  frequency: "WEEKLY";
  deliveryCategory: "STANDARD" | "SPECIAL_MISSION";
  customerId: string;
  companyId: string;
  customer: { email: string };
  pickupAddress: null;
  pickupCity: null;
  pickupPostalCode: null;
  pickupInstructions: null;
  pickupStops: never[];
  shippingAddress: string;
  shippingCity: string;
  shippingPostalCode: string;
  deliveryInstructions: null;
  notes: null;
  items: { name: string; quantity: number; estimatedPrice: number }[];
};

type Service = {
  processDueRecurringOrders(options?: { now?: Date; maxOccurrences?: number }): Promise<{
    processed: number;
    failed: number;
    cancelled: number;
    skipped: number;
    hasMore: boolean;
  }>;
};

function load<T>(
  file: string,
  deps: Record<string, unknown>,
  globals: Record<string, unknown> = {}
): T {
  const module = { exports: {} };
  const js = ts.transpileModule(readFileSync(resolve(file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(js, {
    Date,
    Error,
    Math,
    Number,
    Promise,
    Set,
    console: { error: () => undefined },
    exports: module.exports,
    module,
    require: (id: string) => {
      assert.ok(id in deps, `Unexpected dependency ${id}`);
      return deps[id];
    },
    ...globals,
  });
  return module.exports as T;
}

function recurring(overrides: Partial<Recurring> = {}): Recurring {
  return {
    id: "recurring-a",
    status: "ACTIVE",
    startAt: new Date("2026-01-01T00:00:00.000Z"),
    nextRunAt: new Date("2026-01-01T00:00:00.000Z"),
    endAt: null,
    intervalValue: 1,
    intervalUnit: "DAYS",
    frequency: "WEEKLY",
    deliveryCategory: "STANDARD",
    customerId: "customer-a",
    companyId: "company-a",
    customer: { email: "client@example.test" },
    pickupAddress: null,
    pickupCity: null,
    pickupPostalCode: null,
    pickupInstructions: null,
    pickupStops: [],
    shippingAddress: "10 rue Exemple",
    shippingCity: "Paris",
    shippingPostalCode: "75001",
    deliveryInstructions: null,
    notes: null,
    items: [{ name: "Colis", quantity: 1, estimatedPrice: 10 }],
    ...overrides,
  };
}

function fixture(rows: Recurring[], options: { failAdvanceOnce?: boolean } = {}) {
  const orders = new Map<string, { requestedDeliveryDate: string }>();
  let createCalls = 0;
  let failAdvance = options.failAdvanceOnce ?? false;

  const prisma = {
    recurringOrder: {
      findMany: async ({ where, take }: any) => {
        const excluded = new Set(where.id?.notIn ?? []);
        return rows
          .filter(
            (row) =>
              row.status === "ACTIVE" &&
              row.nextRunAt <= where.nextRunAt.lte &&
              row.startAt <= where.startAt.lte &&
              !excluded.has(row.id)
          )
          .sort(
            (a, b) =>
              a.nextRunAt.getTime() - b.nextRunAt.getTime() || a.id.localeCompare(b.id)
          )
          .slice(0, take);
      },
      findFirst: async ({ where }: any) =>
        rows.find(
          (row) =>
            row.status === "ACTIVE" &&
            row.nextRunAt <= where.nextRunAt.lte &&
            row.startAt <= where.startAt.lte
        ) ?? null,
      updateMany: async ({ where, data }: any) => {
        const row = rows.find(
          (candidate) =>
            candidate.id === where.id &&
            candidate.status === where.status &&
            candidate.nextRunAt.getTime() === where.nextRunAt.getTime()
        );
        if (!row) return { count: 0 };
        if (failAdvance) {
          failAdvance = false;
          throw new Error("INJECTED_FAILURE_AFTER_DURABLE_ORDER");
        }
        if (data.status) row.status = data.status;
        if (data.nextRunAt) row.nextRunAt = data.nextRunAt;
        return { count: 1 };
      },
      findManyUnused: async () => [],
      create: async () => null,
      update: async () => null,
      findUnique: async () => null,
    },
  };

  const service = load<Service>("src/domains/client-portal/recurring-order.service.ts", {
    "@prisma/client": {},
    "@/services/prisma/client": { prisma },
    "@/lib/validations/order": {},
    "@/domains/order/order.service": {
      createClientOrder: async (...args: any[]) => {
        createCalls += 1;
        const input = args[3];
        const key = args[4].idempotencyKey;
        if (!orders.has(key)) {
          orders.set(key, { requestedDeliveryDate: input.requestedDeliveryDate });
        }
        return { id: key };
      },
    },
    "@/domains/company/company-settings.service": { getCompanyDeliverySlots: async () => ({ mode: "DAY", slots: [] }),
      assertDeliveryCategoryEnabled: async () => undefined,
    },
    "@/domains/order/delivery-slot": {
      deliverySlotChoiceError: () => null,
      recurringOccurrenceDelivery: (_settings: unknown, input: { date: string }) => ({ requestedDeliveryDate: input.date }),
    },
    "@/lib/query/list-limits": {
      CLIENT_RECURRING_TAKE: 50,
      RECURRING_DUE_TAKE: 25,
    },
    "@/lib/order/recurring-pickups": {
      firstPickupFields: () => ({
        pickupAddress: null,
        pickupCity: null,
        pickupPostalCode: null,
        pickupInstructions: null,
      }),
      resolveRecurringPickupStops: () => [],
    },
    "@/lib/order/recurrence-schedule": {
      addRecurringInterval,
      parseRecurringCalendarDate,
      recurringCalendarDateValue,
    },
  });

  return { service, rows, orders, createCalls: () => createCalls };
}

test("les dates calendaires restent en UTC et les fins de mois conservent l'ancre", () => {
  const january31 = parseRecurringCalendarDate("2024-01-31");
  const february = addRecurringInterval(january31, 1, "MONTHS", january31);
  const march = addRecurringInterval(february, 1, "MONTHS", january31);

  assert.equal(february.toISOString(), "2024-02-29T00:00:00.000Z");
  assert.equal(march.toISOString(), "2024-03-31T00:00:00.000Z");
  assert.equal(recurringCalendarDateValue(march), "2024-03-31");
  assert.equal(parseRecurringCalendarDate("2026-03-08").toISOString(), "2026-03-08T00:00:00.000Z");
  assert.throws(() => parseRecurringCalendarDate("2026-02-30"));
});

test("le worker draine 100 échéances en lots sans perte ni doublon", async () => {
  const row = recurring({ endAt: new Date("2026-04-10T23:59:59.999Z") });
  const f = fixture([row]);
  const result = await f.service.processDueRecurringOrders({
    now: new Date("2026-04-10T12:00:00.000Z"),
    maxOccurrences: 150,
  });

  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    processed: 100,
    failed: 0,
    cancelled: 0,
    skipped: 0,
    hasMore: false,
  });
  assert.equal(f.orders.size, 100);
  assert.equal(f.createCalls(), 100);
  assert.equal(row.status, "CANCELLED");
  assert.equal([...f.orders.values()][0]?.requestedDeliveryDate, "2026-01-01");
  assert.equal([...f.orders.values()][99]?.requestedDeliveryDate, "2026-04-10");
});

test("une panne après l'occurrence durable rejoue une seule commande puis avance", async () => {
  const row = recurring();
  const f = fixture([row], { failAdvanceOnce: true });
  const now = new Date("2026-01-01T12:00:00.000Z");

  const failed = await f.service.processDueRecurringOrders({ now });
  assert.equal(failed.failed, 1);
  assert.equal(failed.hasMore, true);
  assert.equal(row.nextRunAt.toISOString(), "2026-01-01T00:00:00.000Z");
  assert.equal(f.orders.size, 1);

  const replayed = await f.service.processDueRecurringOrders({ now });
  assert.equal(replayed.processed, 1);
  assert.equal(replayed.failed, 0);
  assert.equal(replayed.hasMore, false);
  assert.equal(row.nextRunAt.toISOString(), "2026-01-02T00:00:00.000Z");
  assert.equal(f.orders.size, 1);
  assert.equal(f.createCalls(), 2);
});

test("pause, annulation et fin dépassée ne créent aucune commande", async () => {
  const paused = recurring({ id: "paused", status: "PAUSED" });
  const cancelled = recurring({ id: "cancelled", status: "CANCELLED" });
  const ended = recurring({
    id: "ended",
    nextRunAt: new Date("2026-01-02T00:00:00.000Z"),
    endAt: new Date("2026-01-01T23:59:59.999Z"),
  });
  const f = fixture([paused, cancelled, ended]);
  const result = await f.service.processDueRecurringOrders({
    now: new Date("2026-01-03T00:00:00.000Z"),
  });

  assert.equal(result.processed, 0);
  assert.equal(result.cancelled, 1);
  assert.equal(result.hasMore, false);
  assert.equal(ended.status, "CANCELLED");
  assert.equal(f.orders.size, 0);
});

test("le cron refuse un secret absent ou incorrect avant de lancer le worker", async () => {
  let calls = 0;
  const route = load<{ GET(request: Request): Promise<Response> }>(
    "src/app/api/cron/recurring-orders/route.ts",
    {
      "next/server": { NextResponse: { json: Response.json } },
      "@/domains/client-portal/recurring-order.service": {
        processDueRecurringOrders: async () => {
          calls += 1;
          return { processed: 0, failed: 0, cancelled: 0, skipped: 0, hasMore: false };
        },
      },
      "@/lib/operations/incident-reporter": {
        reportOperationalIncident: async () => ({ logged: true, webhook: "disabled" }),
      },
    },
    { Request, Response, process: { env: { CRON_SECRET: "ops01-secret" } } }
  );

  assert.equal((await route.GET(new Request("https://test.invalid"))).status, 401);
  assert.equal(
    (await route.GET(new Request("https://test.invalid", {
      headers: { authorization: "Bearer wrong" },
    }))).status,
    401
  );
  assert.equal(calls, 0);
});

test("le cron rend les reprises visibles avec 503 et confirme un drainage complet", async () => {
  let summary = { processed: 4, failed: 1, cancelled: 0, skipped: 0, hasMore: true };
  const route = load<{ GET(request: Request): Promise<Response> }>(
    "src/app/api/cron/recurring-orders/route.ts",
    {
      "next/server": { NextResponse: { json: Response.json } },
      "@/domains/client-portal/recurring-order.service": {
        processDueRecurringOrders: async () => summary,
      },
      "@/lib/operations/incident-reporter": {
        reportOperationalIncident: async () => ({ logged: true, webhook: "disabled" }),
      },
    },
    { Request, Response, process: { env: { CRON_SECRET: "ops01-secret" } } }
  );
  const request = () => new Request("https://test.invalid", {
    headers: { authorization: "Bearer ops01-secret" },
  });

  const pending = await route.GET(request());
  assert.equal(pending.status, 503);
  assert.equal((await pending.json()).success, false);

  summary = { processed: 5, failed: 0, cancelled: 0, skipped: 0, hasMore: false };
  const complete = await route.GET(request());
  assert.equal(complete.status, 200);
  assert.equal((await complete.json()).success, true);
});
