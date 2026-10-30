import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { createHash } from "node:crypto";
import ts from "typescript";

type FailureStage = "order" | "items" | "delivery" | "job" | null;
type Row = Record<string, unknown>;

function load<T>(file: string, deps: Record<string, unknown>): T {
  const module = { exports: {} };
  const js = ts.transpileModule(readFileSync(resolve(file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(js, {
    Date,
    Error,
    Promise,
    console: { error: () => undefined },
    exports: module.exports,
    module,
    require: (id: string) => {
      assert.ok(id in deps, `Unexpected dependency ${id}`);
      return deps[id];
    },
  });
  return module.exports as T;
}

function fixture(failureStage: FailureStage) {
  const state = {
    orders: [] as Row[],
    stops: [] as Row[],
    items: [] as Row[],
    deliveries: [] as Row[],
    addresses: [] as Row[],
    jobs: [] as Row[],
    jobKicks: [] as string[],
    usage: [] as string[],
  };
  const transactionOptions: Array<{ maxWait?: number; timeout?: number } | undefined> = [];
  let orderSequence = 0;
  let stopSequence = 0;
  let itemSequence = 0;
  let deliverySequence = 0;

  const tx = {
    order: {
      create: async ({ data }: { data: Row }) => {
        if (failureStage === "order") throw new Error("INJECTED_ORDER_FAILURE");
        const order = { ...data, id: `order-${++orderSequence}` };
        const stops = ((data.stops as { create?: Row[] } | undefined)?.create ?? []).map(
          (stop) => ({ ...stop, id: `stop-${++stopSequence}`, orderId: order.id })
        );
        const items = ((data.items as { create?: Row[] } | undefined)?.create ?? []).map(
          (item) => ({ ...item, id: `item-${++itemSequence}`, orderId: order.id })
        );
        state.orders.push(order);
        state.stops.push(...stops);
        state.items.push(...items);
        return { ...order, stops, items };
      },
    },
    orderItem: {
      createMany: async ({ data }: { data: Row[] }) => {
        if (failureStage === "items") throw new Error("INJECTED_ITEM_FAILURE");
        state.items.push(
          ...data.map((item) => ({ ...item, id: `item-${++itemSequence}` }))
        );
        return { count: data.length };
      },
      findMany: async ({ where }: { where: { orderId: string } }) =>
        state.items.filter((item) => item.orderId === where.orderId),
    },
    delivery: {
      create: async ({ data }: { data: Row }) => {
        if (failureStage === "delivery") throw new Error("INJECTED_DELIVERY_FAILURE");
        const delivery = { ...data, id: `delivery-${++deliverySequence}` };
        state.deliveries.push(delivery);
        return delivery;
      },
    },
    operationJob: {
      upsert: async ({ create }: { create: Row }) => {
        if (failureStage === "job") throw new Error("INJECTED_JOB_FAILURE");
        const existing = state.jobs.find((job) => job.jobKey === create.jobKey);
        if (existing) return existing;
        const job = { ...create, id: `job-${state.jobs.length + 1}`, status: "PENDING" };
        state.jobs.push(job);
        return job;
      },
    },
  };

  const prisma = {
    order: {
      findFirst: async ({ where }: { where: Row }) =>
        state.orders.find(
          (order) =>
            order.customerId === where.customerId &&
            order.companyId === where.companyId &&
            order.idempotencyKey === where.idempotencyKey
        ) ?? null,
    },
    $transaction: async (
      callback: (client: typeof tx) => Promise<unknown>,
      options?: { maxWait?: number; timeout?: number }
    ) => {
      transactionOptions.push(options);
      const snapshot = Object.fromEntries(
        Object.entries(state).map(([key, rows]) => [key, [...rows]])
      ) as typeof state;
      try {
        return await callback(tx);
      } catch (error) {
        state.orders.splice(0, state.orders.length, ...snapshot.orders);
        state.stops.splice(0, state.stops.length, ...snapshot.stops);
        state.items.splice(0, state.items.length, ...snapshot.items);
        state.deliveries.splice(0, state.deliveries.length, ...snapshot.deliveries);
        state.addresses.splice(0, state.addresses.length, ...snapshot.addresses);
        state.jobs.splice(0, state.jobs.length, ...snapshot.jobs);
        state.jobKicks.splice(0, state.jobKicks.length, ...snapshot.jobKicks);
        state.usage.splice(0, state.usage.length, ...snapshot.usage);
        throw error;
      }
    },
  };

  const service = load<typeof import("../src/domains/order/order.service")>(
    "src/domains/order/order.service.ts",
    {
      "@/domains/order/delivery-slot": { requestedDeliveryInstant: (value: string) => new Date(value) },
      "@/services/prisma/client": { prisma },
      "node:crypto": { createHash },
      "@/domains/client-portal/address.service": {
        createClientAddress: async (_userId: string, input: Row) => {
          state.addresses.push(input);
          return input;
        },
      },
      "@/domains/order/resolve-customer": { resolveCustomersByEmail: (rows: unknown) => rows },
      "@/lib/constants/order-status": {
        ACTIVE_ORDER_STATUSES: [],
        FULFILLMENT_STATUS_LABELS: {},
        getFulfillmentStatusLabel: () => "",
        HISTORY_ORDER_STATUSES: [],
      },
      "@/lib/order-reference": {
        generateOrderReference: async () => "CMD-ATOMIC",
        generateDeliveryReference: async () => "LIV-ATOMIC",
      },
      "@/lib/order/courier-pickups": {
        formatStopAddress: (stop: { address: string }) => stop.address,
        getPrimaryCourierPickupFields: (stops: { address: string; city?: string; postalCode?: string }[]) => ({
          pickupAddress: stops[0]?.address ?? null,
          pickupCity: stops[0]?.city ?? null,
          pickupPostalCode: stops[0]?.postalCode ?? null,
        }),
      },
      "@/lib/order/reorder-template": { buildReorderFormValues: () => ({}) },
      // Lecture client seulement (getClientOrderById) : hors des parcours de création testés ici.
      "@/domains/company/portal-settings.service": { getPortalShowDriverPhone: async () => true },
      "@/domains/delivery/client-driver": {},
      "@/domains/delivery/delivery-coordinates": {
        resolveDeliveryCoordinateFields: async () => ({
          latitude: 1,
          longitude: 2,
          pickupLatitude: 3,
          pickupLongitude: 4,
        }),
        resolveStopCoordinates: async () => ({ latitude: 3, longitude: 4 }),
      },
      "@/lib/query/list-limits": { CLIENT_ORDERS_TAKE: 100, COMPANY_ORDERS_TAKE: 100 },
      "@/lib/query/order-history": { ORDER_EXPORT_CHUNK_SIZE: 500 },
      "@/domains/operations/operation-job.service": {
        enqueueAutoDispatchJob: async (
          db: typeof tx,
          input: { companyId: string; deliveryId: string }
        ) =>
          db.operationJob.upsert({
            create: {
              jobKey: `auto-dispatch:${input.deliveryId}`,
              type: "AUTO_DISPATCH",
              companyId: input.companyId,
              payload: input,
            },
          }),
        kickOperationJob: (jobId: string) => state.jobKicks.push(jobId),
      },
      "@/domains/saas/saas.service": {
        assertCanCreateOrder: async () => ({ features: new Set(["auto_dispatch"]) }),
        recordOrderCreatedUsage: async (_db: unknown, input: { orderId: string }) => {
          state.usage.push(input.orderId);
        },
        resolveCompanySaasAccess: async () => ({ features: new Set(["auto_dispatch"]) }),
      },
      "@/domains/client-portal/notify.service": {
        queueDeliveryStatusNotification: async () => null,
      },
      "@/domains/invoice/delivery-invoice.service": {
        queueDeliveryInvoiceJob: async () => null,
      },
      "@/domains/invoice/invoice-due": { isInvoiceOutstanding: () => false, OUTSTANDING_INVOICE_STATUSES: ["PENDING", "OVERDUE"] },
      "@/domains/delivery/dispatch-policy": {
        getCancellationBlockReason: () => null,
      },
    }
  );

  return { service, state, transactionOptions };
}

const standardInput = {
  deliveryCategory: "STANDARD" as const,
  items: [{ name: "Colis", quantity: 1, estimatedPrice: 10 }],
  stops: undefined,
  pickupStops: undefined,
  shippingAddress: "10 rue Test",
  shippingCity: "Paris",
  shippingPostalCode: "75001",
  saveAddress: true,
  addressLabel: "Bureau",
};

const courierInput = {
  deliveryCategory: "COURIER" as const,
  items: [],
  stops: undefined,
  pickupStops: [
    {
      label: "Collecte",
      address: "1 rue Départ",
      city: "Paris",
      postalCode: "75001",
      items: [{ name: "Dossier", quantity: 1, estimatedPrice: 15 }],
    },
  ],
  shippingAddress: "20 rue Arrivée",
  shippingCity: "Paris",
  shippingPostalCode: "75002",
};

for (const [stage, input] of [
  ["order", standardInput],
  ["items", courierInput],
  ["delivery", courierInput],
  ["job", courierInput],
] as const) {
  test(`panne injectée à l'étape ${stage} : aucune commande, article, étape ou livraison partielle`, async () => {
    const f = fixture(stage);
    await assert.rejects(
      f.service.createClientOrder("client-a", "company-a", "client@example.com", input),
      /INJECTED_/
    );
    assert.deepEqual(
      {
        orders: f.state.orders.length,
        stops: f.state.stops.length,
        items: f.state.items.length,
        deliveries: f.state.deliveries.length,
        addresses: f.state.addresses.length,
        jobs: f.state.jobs.length,
        jobKicks: f.state.jobKicks.length,
      },
      { orders: 0, stops: 0, items: 0, deliveries: 0, addresses: 0, jobs: 0, jobKicks: 0 }
    );
  });
}

for (const [label, input] of [
  ["standard", standardInput],
  ["coursier", courierInput],
] as const) {
  test(`création ${label} réussie : une chaîne complète est validée avant les effets annexes`, async () => {
    const f = fixture(null);
    const order = await f.service.createClientOrder(
      "client-a",
      "company-a",
      "client@example.com",
      input
    );
    await Promise.resolve();
    assert.equal(order.id, "order-1");
    assert.equal(f.state.orders.length, 1);
    assert.equal(f.state.deliveries.length, 1);
    assert.equal(f.state.items.length, 1);
    assert.equal(f.state.stops.length, label === "coursier" ? 1 : 0);
    assert.equal(f.state.addresses.length, label === "standard" ? 1 : 0);
    assert.equal(f.state.jobs.length, 1);
    assert.deepEqual(f.state.jobKicks, ["job-1"]);
  });
}

// Délai Prisma par défaut d'une transaction interactive. Mesure ONBOARD-1 : environ dix
// allers-retours séquentiels à ~550 ms via le pooler distant dépassent ce délai (DISPATCH-3).
const PRISMA_DEFAULT_TRANSACTION_TIMEOUT_MS = 5_000;
const REMOTE_ORDER_TRANSACTION_BUDGET_MS = 10 * 550;

for (const [label, input] of [
  ["standard", standardInput],
  ["coursier", courierInput],
] as const) {
  test(`création ${label} avec dispatch automatique : délai de transaction adapté à la base distante`, async () => {
    const f = fixture(null);
    await f.service.createClientOrder("client-a", "company-a", "client@example.com", input);
    assert.equal(f.transactionOptions.length, 1);
    const timeout = f.transactionOptions[0]?.timeout ?? PRISMA_DEFAULT_TRANSACTION_TIMEOUT_MS;
    assert.ok(
      timeout >= REMOTE_ORDER_TRANSACTION_BUDGET_MS,
      `délai ${timeout} ms inférieur au budget mesuré ${REMOTE_ORDER_TRANSACTION_BUDGET_MS} ms`
    );
    assert.ok((f.transactionOptions[0]?.maxWait ?? 0) >= 10_000);
    assert.equal(f.state.jobs.length, 1, "le job d'auto-dispatch reste dans la même transaction");
  });
}

test("double envoi avec la même clé : une seule commande, livraison et tâche", async () => {
  const f = fixture(null);
  const request = { idempotencyKey: "checkout-double-click-1" };

  const first = await f.service.createClientOrder(
    "client-a",
    "company-a",
    "client@example.com",
    standardInput,
    request
  );
  const replay = await f.service.createClientOrder(
    "client-a",
    "company-a",
    "client@example.com",
    standardInput,
    request
  );

  assert.equal(replay.id, first.id);
  assert.equal(f.state.orders.length, 1);
  assert.equal(f.state.deliveries.length, 1);
  assert.equal(f.state.jobs.length, 1);
  assert.equal(f.state.jobKicks.length, 1);
});

test("réutiliser une clé avec une autre commande est refusé", async () => {
  const f = fixture(null);
  const request = { idempotencyKey: "checkout-conflict-1" };
  await f.service.createClientOrder(
    "client-a",
    "company-a",
    "client@example.com",
    standardInput,
    request
  );

  await assert.rejects(
    f.service.createClientOrder(
      "client-a",
      "company-a",
      "client@example.com",
      { ...standardInput, shippingAddress: "11 rue Différente" },
      request
    ),
    /IDEMPOTENCY_KEY_REUSED/
  );
  assert.equal(f.state.orders.length, 1);
});
