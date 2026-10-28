import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const servicePath = new URL("../src/domains/data-lifecycle/company-export.service.ts", import.meta.url);
const fixedNow = "2026-10-25T12:00:00.000Z";

type QueryArgs = {
  where?: Record<string, unknown>;
  take?: number;
  orderBy?: unknown;
  select?: Record<string, unknown>;
  include?: Record<string, unknown>;
};

type ScopedValue = {
  companyId: string;
  value: Record<string, unknown>;
};

type ExportVisitor = {
  start(header: unknown, company: unknown): Promise<void>;
  page(collection: string, rows: unknown[]): Promise<void>;
};

type ExportModule = {
  exportCompanyData(companyId: string, options?: { pageSize?: number }): Promise<unknown>;
  visitCompanyExport(companyId: string, visitor: ExportVisitor, options?: { pageSize?: number }): Promise<unknown>;
  createCompanyExportJsonWriter(write: (text: string) => Promise<void>): {
    visitor: ExportVisitor;
    finish(summary: unknown): Promise<void>;
  };
};

class FixedDate extends Date {
  constructor(value?: string | number | Date) {
    if (value instanceof Date) {
      super(value.getTime());
      return;
    }
    super(value ?? fixedNow);
  }

  static override now() {
    return Date.parse(fixedNow);
  }
}

function normalize<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function loadService(prisma: Record<string, unknown>): ExportModule {
  const source = readFileSync(servicePath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: servicePath.pathname,
  }).outputText;
  const module = { exports: {} as Record<string, unknown> };

  runInNewContext(compiled, {
    Date: FixedDate,
    Error,
    Boolean,
    module,
    exports: module.exports,
    require(id: string) {
      if (id === "@prisma/client") {
        return { Prisma: { TransactionIsolationLevel: { RepeatableRead: "RepeatableRead" } } };
      }
      if (id === "@/services/prisma/client") {
        return { prisma };
      }
      throw new Error(`Dépendance inattendue dans l'export : ${id}`);
    },
  });

  return module.exports as ExportModule;
}

function assertJsonEqual(actual: unknown, expected: unknown, label: string) {
  assert.equal(JSON.stringify(actual), JSON.stringify(expected), label);
}

function makeRepository() {
  const date = new Date("2026-10-24T08:00:00.000Z");
  const otherDate = new Date("2026-10-24T08:00:01.000Z");
  const calls: Array<{ model: string; args: QueryArgs }> = [];
  const companies = new Map<string, Record<string, unknown>>([
    [
      "company-a",
      {
        id: "company-a",
        name: "Société Exemple A",
        slug: "societe-exemple-a",
        logoUrl: null,
        email: "contact+a@example.invalid",
        phone: "+33000000001",
        address: "1 rue Exemple",
        city: "Paris",
        country: "FR",
        status: "ACTIVE",
        isDemo: false,
        settings: { locale: "fr" },
        createdAt: date,
        updatedAt: date,
      },
    ],
    [
      "company-b",
      {
        id: "company-b",
        name: "Société Exemple B — FOREIGN_B_SENTINEL",
        slug: "societe-exemple-b",
        logoUrl: null,
        email: "contact+b@example.invalid",
        phone: "+33000000002",
        address: "2 rue Exemple",
        city: "Paris",
        country: "FR",
        status: "ACTIVE",
        isDemo: false,
        settings: { locale: "fr" },
        createdAt: otherDate,
        updatedAt: otherDate,
      },
    ],
  ]);
  const records: Record<string, ScopedValue[]> = {
    user: [
      {
        companyId: "company-a",
        value: {
          id: "user-a",
          email: "ops+shared-a@example.invalid",
          firstName: "Alex",
          lastName: "Exemple",
          phone: "+33000000011",
          avatarUrl: null,
          settings: { theme: "light" },
          status: "ACTIVE",
          role: { name: "Administrateur", slug: "company-admin", systemRole: "COMPANY_ADMIN" },
          createdAt: date,
          updatedAt: date,
          lastLoginAt: date,
          addresses: [{ id: "address-a", label: "Dépôt A", createdAt: date }],
          driverLocation: { id: "location-a", latitude: 48.8, longitude: 2.3 },
          notifications: [
            {
              id: "notification-a",
              type: "ORDER_STATUS",
              title: "Commande CMD-PROCHE-A",
              body: "Mise à jour A",
              href: "/orders/order-a",
              readAt: null,
              orderMessageId: "message-a",
              createdAt: date,
            },
          ],
        },
      },
      {
        companyId: "company-b",
        value: {
          id: "user-b",
          email: "ops+shared-b@example.invalid",
          firstName: "Alex",
          lastName: "FOREIGN_B_SENTINEL",
          role: { name: "Administrateur", slug: "company-admin", systemRole: "COMPANY_ADMIN" },
          addresses: [{ id: "address-b", label: "FOREIGN_B_SENTINEL" }],
          driverLocation: { id: "location-b" },
          notifications: [{ id: "notification-b", title: "FOREIGN_B_SENTINEL" }],
        },
      },
    ],
    recurringOrder: [
      {
        companyId: "company-a",
        value: { id: "recurring-a", companyId: "company-a", reference: "REC-PROCHE-A", createdAt: date },
      },
      {
        companyId: "company-b",
        value: { id: "recurring-b", companyId: "company-b", reference: "REC-PROCHE-B-FOREIGN_B_SENTINEL" },
      },
    ],
    order: [
      {
        companyId: "company-a",
        value: {
          id: "order-a",
          companyId: "company-a",
          reference: "CMD-PROCHE-A",
          status: "DELIVERED",
          source: "MANUAL",
          totalAmount: 1000,
          itemCount: 1,
          notes: "Note A",
          deliveryCategory: "STANDARD",
          pickupAddress: "1 rue Départ",
          pickupCity: "Paris",
          pickupPostalCode: "75001",
          pickupInstructions: null,
          shippingAddress: "1 rue Arrivée",
          shippingCity: "Paris",
          shippingPostalCode: "75002",
          deliveryInstructions: null,
          requestedDeliveryDate: date,
          missionDescription: "Mission A",
          customerId: "customer-a",
          customerEmail: "client+shared-a@example.invalid",
          recurringOrderId: "recurring-a",
          createdAt: date,
          updatedAt: date,
          items: [{ id: "item-a", orderId: "order-a", label: "Colis A" }],
          stops: [{ id: "stop-a", orderId: "order-a", sequence: 1 }],
          deliveries: [
            {
              id: "delivery-a",
              companyId: "company-a",
              orderId: "order-a",
              reference: "LIV-PROCHE-A",
              podPhotoPath: "company-a/delivery-a/proof.jpg",
              createdAt: date,
              trackingEvents: [
                { id: "tracking-a", deliveryId: "delivery-a", status: "DELIVERED", occurredAt: date },
              ],
            },
          ],
          messages: [
            {
              id: "message-a",
              authorId: "user-a",
              authorName: "Alex Exemple",
              authorRole: "COMPANY_ADMIN",
              body: "Message A",
              kind: "MESSAGE",
              internal: false,
              createdAt: date,
            },
          ],
          threadReads: [{ id: "read-a", userId: "user-a", seenAt: date, seenId: "message-a" }],
        },
      },
      {
        companyId: "company-b",
        value: {
          id: "order-b",
          companyId: "company-b",
          reference: "CMD-PROCHE-B-FOREIGN_B_SENTINEL",
          items: [{ id: "item-b" }],
          stops: [{ id: "stop-b" }],
          deliveries: [{ id: "delivery-b", reference: "FOREIGN_B_SENTINEL", trackingEvents: [] }],
          messages: [{ id: "message-b", body: "FOREIGN_B_SENTINEL" }],
          threadReads: [{ id: "read-b" }],
        },
      },
    ],
    invoice: [
      {
        companyId: "company-a",
        value: { id: "invoice-a", companyId: "company-a", number: "FAC-PROCHE-A", createdAt: date },
      },
      {
        companyId: "company-b",
        value: { id: "invoice-b", companyId: "company-b", number: "FAC-PROCHE-B-FOREIGN_B_SENTINEL" },
      },
    ],
    supportTicket: [
      {
        companyId: "company-a",
        value: {
          id: "ticket-a",
          companyId: "company-a",
          subject: "Sujet A",
          createdAt: date,
          messages: [{ id: "support-message-a", ticketId: "ticket-a", body: "Réponse A", createdAt: date }],
        },
      },
      {
        companyId: "company-b",
        value: {
          id: "ticket-b",
          companyId: "company-b",
          subject: "FOREIGN_B_SENTINEL",
          messages: [{ id: "support-message-b", body: "FOREIGN_B_SENTINEL" }],
        },
      },
    ],
    operationJob: [
      {
        companyId: "company-a",
        value: {
          id: "job-a",
          jobKey: "job-a-key",
          type: "AUTO_DISPATCH",
          status: "SUCCEEDED",
          attempts: 1,
          maxAttempts: 3,
          nextAttemptAt: null,
          lockedAt: null,
          completedAt: date,
          createdAt: date,
          updatedAt: date,
        },
      },
      {
        companyId: "company-b",
        value: { id: "job-b", jobKey: "FOREIGN_B_SENTINEL", payload: { secret: "FOREIGN_B_SENTINEL" } },
      },
    ],
    saasSubscription: [
      {
        companyId: "company-a",
        value: {
          id: "subscription-a",
          kind: "COMMERCIAL",
          status: "ACTIVE",
          billingInterval: "MONTHLY",
          startsAt: date,
          currentPeriodStart: date,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          endedAt: null,
          premiumDiscoveryEndsAt: null,
          createdAt: date,
          updatedAt: date,
          planAssignments: [
            { id: "assignment-a", effectiveFrom: date, effectiveTo: null, plan: { code: "PRO", name: "Pro" } },
          ],
          items: [
            {
              id: "subscription-item-a",
              code: "extra_driver",
              kind: "EXTRA_SEAT",
              source: "INITIAL",
              quantity: 2,
              unitPriceCents: 900,
              effectiveFrom: date,
              effectiveTo: null,
            },
          ],
          usagePeriods: [
            {
              id: "usage-a",
              startsAt: date,
              endsAt: otherDate,
              includedOrders: 3000,
              orderCount: 12,
              overageCount: 0,
              orderOverageUnitPriceCents: 8,
              closedAt: null,
            },
          ],
        },
      },
      {
        companyId: "company-b",
        value: {
          id: "subscription-b",
          status: "FOREIGN_B_SENTINEL",
          planAssignments: [{ id: "assignment-b" }],
          items: [{ id: "subscription-item-b" }],
          usagePeriods: [{ id: "usage-b" }],
        },
      },
    ],
  };

  function record(model: string, args: QueryArgs) {
    calls.push({ model, args });
  }

  function findMany(model: string, args: QueryArgs) {
    record(model, args);
    const companyId = args.where?.companyId;
    assert.equal(typeof companyId, "string", `${model} doit être filtré par companyId`);
    // Reproduit la pagination par clé (createdAt, id) que l'export envoie à PostgreSQL.
    const keyset = args.where?.OR as
      | [{ createdAt: { gt: string } }, { createdAt: string; id: { gt: string } }]
      | undefined;
    const key = (value: Record<string, unknown>) => `${String(value.createdAt ?? "")}\u0000${String(value.id)}`;
    const rows = (records[model] ?? [])
      .filter((entry) => entry.companyId === companyId)
      .map((entry) => normalize(entry.value))
      .filter((value) => !keyset || key(value) > `${keyset[1].createdAt}\u0000${keyset[1].id.gt}`)
      .sort((left, right) => (key(left) < key(right) ? -1 : key(left) > key(right) ? 1 : 0));
    return args.take === undefined ? rows : rows.slice(0, args.take);
  }

  const tx = {
    company: {
      async findUnique(args: QueryArgs) {
        record("company", args);
        const id = args.where?.id;
        return typeof id === "string" ? normalize(companies.get(id) ?? null) : null;
      },
    },
    user: { findMany: async (args: QueryArgs) => findMany("user", args) },
    recurringOrder: { findMany: async (args: QueryArgs) => findMany("recurringOrder", args) },
    order: { findMany: async (args: QueryArgs) => findMany("order", args) },
    invoice: { findMany: async (args: QueryArgs) => findMany("invoice", args) },
    supportTicket: { findMany: async (args: QueryArgs) => findMany("supportTicket", args) },
    operationJob: { findMany: async (args: QueryArgs) => findMany("operationJob", args) },
    saasSubscription: { findMany: async (args: QueryArgs) => findMany("saasSubscription", args) },
  };

  const prisma = {
    async $transaction(
      callback: (client: typeof tx) => Promise<unknown>,
      options: Record<string, unknown>
    ) {
      assertJsonEqual(
        options,
        { isolationLevel: "RepeatableRead", maxWait: 10_000, timeout: 600_000 },
        "la transaction garde son niveau d'isolation et ses bornes"
      );
      return callback(tx);
    },
  };

  return { calls, prisma, records };
}

function assertCurrentQueryContract(calls: Array<{ model: string; args: QueryArgs }>) {
  const firstRun = calls.slice(0, 8);
  assert.deepEqual(
    firstRun.map((call) => call.model),
    ["company", "user", "recurringOrder", "order", "invoice", "supportTicket", "operationJob", "saasSubscription"]
  );
  for (const call of firstRun.slice(1)) {
    assertJsonEqual(call.args.where, { companyId: "company-a" }, `${call.model} reste isolé à l'entreprise`);
    assertJsonEqual(
      call.args.orderBy,
      [{ createdAt: "asc" }, { id: "asc" }],
      `${call.model} garde un tri stable`
    );
  }

  const company = firstRun[0]?.args.select ?? {};
  assert.equal(company.settings, true);
  assert.equal("legalName" in company, false);

  const user = firstRun[1]?.args.select ?? {};
  assert.equal("authId" in user, false);
  assertJsonEqual(
    (user.role as { select?: unknown }).select,
    { name: true, slug: true, systemRole: true },
    "Role reste une projection partielle"
  );
  assertJsonEqual(
    (user.addresses as { orderBy?: unknown }).orderBy,
    [{ createdAt: "asc" }, { id: "asc" }],
    "les adresses gardent un tri stable"
  );
  assertJsonEqual(
    (user.notifications as { orderBy?: unknown }).orderBy,
    [{ createdAt: "asc" }, { id: "asc" }],
    "les notifications gardent un tri stable"
  );

  const order = firstRun[3]?.args.select ?? {};
  assert.equal("idempotencyKey" in order, false);
  assertJsonEqual((order.items as { orderBy?: unknown }).orderBy, { id: "asc" }, "les articles gardent un tri stable");
  assertJsonEqual(
    (order.stops as { orderBy?: unknown }).orderBy,
    [{ sequence: "asc" }, { id: "asc" }],
    "les étapes gardent un tri stable"
  );
  assertJsonEqual(
    (order.deliveries as { orderBy?: unknown }).orderBy,
    [{ createdAt: "asc" }, { id: "asc" }],
    "les livraisons gardent un tri stable"
  );
  const trackingEvents = (
    (order.deliveries as { include?: Record<string, unknown> }).include?.trackingEvents as { orderBy?: unknown }
  ).orderBy;
  assertJsonEqual(
    trackingEvents,
    [{ occurredAt: "asc" }, { id: "asc" }],
    "le suivi garde un tri stable"
  );
  assertJsonEqual(
    (order.messages as { orderBy?: unknown }).orderBy,
    [{ createdAt: "asc" }, { id: "asc" }],
    "les messages gardent un tri stable"
  );
  assertJsonEqual(
    (order.threadReads as { orderBy?: unknown }).orderBy,
    { id: "asc" },
    "les lectures gardent un tri stable"
  );

  const support = firstRun[5]?.args.include ?? {};
  assertJsonEqual(
    (support.messages as { orderBy?: unknown }).orderBy,
    [{ createdAt: "asc" }, { id: "asc" }],
    "les réponses support gardent un tri stable"
  );

  const job = firstRun[6]?.args.select ?? {};
  assert.deepEqual(Object.keys(job), [
    "id",
    "jobKey",
    "type",
    "status",
    "attempts",
    "maxAttempts",
    "nextAttemptAt",
    "lockedAt",
    "completedAt",
    "createdAt",
    "updatedAt",
  ]);
  assert.equal("payload" in job, false);
  assert.equal("lastError" in job, false);

  const subscription = firstRun[7]?.args.select ?? {};
  assert.deepEqual(Object.keys(subscription), [
    "id",
    "kind",
    "status",
    "billingInterval",
    "startsAt",
    "currentPeriodStart",
    "currentPeriodEnd",
    "cancelAtPeriodEnd",
    "endedAt",
    "premiumDiscoveryEndsAt",
    "createdAt",
    "updatedAt",
    "planAssignments",
    "items",
    "usagePeriods",
  ]);
  for (const excluded of ["providerCustomerId", "providerSubscriptionId", "snapshot", "billingAccount", "usageEvents", "seatReservations"]) {
    assert.equal(excluded in subscription, false, `${excluded} reste hors de l'export`);
  }
  const assignments = subscription.planAssignments as { orderBy?: unknown; select?: Record<string, unknown> };
  assertJsonEqual(assignments.orderBy, [{ effectiveFrom: "asc" }, { id: "asc" }], "les formules gardent un tri stable");
  assertJsonEqual(assignments.select?.plan, { select: { code: true, name: true } }, "la formule n'expose que code et nom");
  assert.equal("snapshot" in (assignments.select ?? {}), false);
  const items = subscription.items as { orderBy?: unknown; select?: Record<string, unknown> };
  assertJsonEqual(items.orderBy, [{ effectiveFrom: "asc" }, { id: "asc" }], "les options gardent un tri stable");
  assert.equal("snapshot" in (items.select ?? {}), false);
  assert.equal("optionId" in (items.select ?? {}), false);
  const usage = subscription.usagePeriods as { orderBy?: unknown };
  assertJsonEqual(usage.orderBy, [{ startsAt: "asc" }, { id: "asc" }], "la consommation garde un tri stable");
}

test("l'export local reste isolé, complet sur son contrat courant et reproductible", async () => {
  const repository = makeRepository();
  const service = loadService(repository.prisma);

  const first = normalize(await service.exportCompanyData("company-a"));
  const second = normalize(await service.exportCompanyData("company-a"));

  assert.equal(JSON.stringify(first), JSON.stringify(second), "la même horloge et les mêmes données donnent le même export");
  const result = first as {
    schema: string;
    version: number;
    exportedAt: string;
    counts: Record<string, number>;
    externalAssets: { proofObjects: unknown[] };
    data: Record<string, unknown>;
  };
  assert.equal(result.schema, "tutelliv-company-export");
  assert.equal(result.version, 1);
  assert.equal(result.exportedAt, fixedNow);
  assertJsonEqual(
    result.counts,
    {
      users: 1,
      addresses: 1,
      notifications: 1,
      recurringOrders: 1,
      orders: 1,
      items: 1,
      stops: 1,
      deliveries: 1,
      trackingEvents: 1,
      orderMessages: 1,
      orderThreadReads: 1,
      invoices: 1,
      supportTickets: 1,
      supportMessages: 1,
      operationJobs: 1,
      subscriptions: 1,
      subscriptionPlans: 1,
      subscriptionItems: 1,
      usagePeriods: 1,
      proofObjects: 1,
    },
    "toutes les catégories actuellement exportées sont comptées"
  );
  assertJsonEqual(
    result.externalAssets.proofObjects,
    [{ deliveryId: "delivery-a", deliveryReference: "LIV-PROCHE-A", objectKey: "company-a/delivery-a/proof.jpg" }],
    "les preuves restent un manifeste de clés, sans lecture Storage"
  );

  const serialized = JSON.stringify(result);
  assert.match(serialized, /company-a/);
  assert.match(serialized, /CMD-PROCHE-A/);
  assert.doesNotMatch(serialized, /company-b|FOREIGN_B_SENTINEL/);
  assert.doesNotMatch(serialized, /authId|requestFingerprint|payload|lastError|providerCustomerId|providerSubscriptionId/);
  assert.match(serialized, /subscription-a/);
  assertCurrentQueryContract(repository.calls);

  assert.equal(repository.calls.length, 16, "chaque export relit uniquement les huit modèles attendus");
});

test("une entreprise absente n'ouvre aucune autre catégorie", async () => {
  const repository = makeRepository();
  const service = loadService(repository.prisma);

  assert.equal(await service.exportCompanyData("company-missing"), null);
  assert.deepEqual(repository.calls.map((call) => call.model), ["company"]);
});

function orderFor(id: string, createdAt: string) {
  return {
    companyId: "company-a",
    value: {
      id,
      companyId: "company-a",
      reference: `CMD-${id}`,
      createdAt,
      items: [],
      stops: [],
      deliveries: [
        {
          id: `delivery-${id}`,
          companyId: "company-a",
          orderId: id,
          reference: `LIV-${id}`,
          podPhotoPath: null,
          createdAt,
          trackingEvents: [],
        },
      ],
      messages: [],
      threadReads: [],
    },
  };
}

test("l'export lit les collections par pages stables, sans doublon ni perte", async () => {
  const repository = makeRepository();
  const sameInstant = "2026-10-24T08:00:00.000Z";
  // Deux commandes partagent l'horodatage de order-a : seule la clé (createdAt, id) les départage.
  repository.records.order!.push(
    orderFor("order-a2", sameInstant),
    orderFor("order-0", sameInstant),
    orderFor("order-c", "2026-10-24T09:00:00.000Z"),
    orderFor("order-d", "2026-10-24T10:00:00.000Z")
  );
  const service = loadService(repository.prisma);

  const result = normalize(await service.exportCompanyData("company-a", { pageSize: 2 })) as {
    counts: Record<string, number>;
    externalAssets: { proofObjects: unknown[] };
    data: { orders: Array<{ id: string }> };
  };

  assert.deepEqual(
    result.data.orders.map((order) => order.id),
    ["order-0", "order-a", "order-a2", "order-c", "order-d"]
  );
  assert.equal(result.counts.orders, 5);
  assert.equal(result.counts.deliveries, 5);
  assert.equal(result.externalAssets.proofObjects.length, 1);

  const orderCalls = repository.calls.filter((call) => call.model === "order");
  assert.equal(orderCalls.length, 3, "cinq commandes en pages de deux : trois lectures");
  for (const call of orderCalls) assert.equal(call.args.take, 2);
  assertJsonEqual(orderCalls[0]?.args.where, { companyId: "company-a" }, "la première page n'a pas de curseur");
  assertJsonEqual(
    orderCalls[1]?.args.where,
    {
      companyId: "company-a",
      OR: [{ createdAt: { gt: sameInstant } }, { createdAt: sameInstant, id: { gt: "order-a" } }],
    },
    "la page suivante reprend après la dernière clé lue, toujours dans l'entreprise"
  );
  for (const call of repository.calls.filter((entry) => entry.model !== "company")) {
    assert.equal((call.args.where as { companyId?: unknown }).companyId, "company-a");
  }
  assert.doesNotMatch(JSON.stringify(result), /company-b|FOREIGN_B_SENTINEL/);
});

test("l'export en flux écrit le même document v1 que l'export en mémoire", async () => {
  for (const pageSize of [1, 100]) {
    const repository = makeRepository();
    repository.records.order!.push(orderFor("order-c", "2026-10-24T09:00:00.000Z"));
    repository.records.invoice = [];
    const service = loadService(repository.prisma);
    const expected = normalize(await service.exportCompanyData("company-a", { pageSize }));

    const chunks: string[] = [];
    const writer = service.createCompanyExportJsonWriter(async (text) => {
      chunks.push(text);
    });
    const summary = await service.visitCompanyExport("company-a", writer.visitor, { pageSize });
    await writer.finish(summary);
    const text = chunks.join("");

    assert.deepEqual(JSON.parse(text), expected, `pages de ${pageSize}`);
    assert.match(text, /"invoices": \[\]/, "une collection vide reste un tableau");
    assert.ok(text.endsWith("}\n"));
    if (pageSize === 1) assert.ok(chunks.length > 10, "le document est écrit par morceaux, pas d'un bloc");
  }
});

test("l'écrivain JSON refuse une collection rouverte et l'export refuse une taille de page hors bornes", async () => {
  const repository = makeRepository();
  const service = loadService(repository.prisma);
  const writer = service.createCompanyExportJsonWriter(async () => undefined);
  await writer.visitor.start({ schema: "tutelliv-company-export", version: 1, exportedAt: fixedNow }, { id: "company-a" });
  await writer.visitor.page("users", []);
  await writer.visitor.page("orders", []);
  await assert.rejects(writer.visitor.page("users", []), /EXPORT_COLLECTION_ORDER/);

  for (const pageSize of [0, 1.5, 1_001, Number.NaN]) {
    await assert.rejects(service.exportCompanyData("company-a", { pageSize }), /EXPORT_INVALID_PAGE_SIZE/);
  }
  assert.equal(repository.calls.length, 0, "une taille invalide n'ouvre aucune lecture");
});
