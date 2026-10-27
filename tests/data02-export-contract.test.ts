import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const servicePath = new URL("../src/domains/data-lifecycle/company-export.service.ts", import.meta.url);
const fixedNow = "2026-10-25T12:00:00.000Z";

type QueryArgs = {
  where?: Record<string, unknown>;
  orderBy?: unknown;
  select?: Record<string, unknown>;
  include?: Record<string, unknown>;
};

type ScopedValue = {
  companyId: string;
  value: Record<string, unknown>;
};

type ExportModule = {
  exportCompanyData(companyId: string): Promise<unknown>;
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
  };

  function record(model: string, args: QueryArgs) {
    calls.push({ model, args });
  }

  function findMany(model: string, args: QueryArgs) {
    record(model, args);
    const companyId = args.where?.companyId;
    assert.equal(typeof companyId, "string", `${model} doit être filtré par companyId`);
    return (records[model] ?? [])
      .filter((entry) => entry.companyId === companyId)
      .map((entry) => normalize(entry.value));
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
  };

  const prisma = {
    async $transaction(
      callback: (client: typeof tx) => Promise<unknown>,
      options: Record<string, unknown>
    ) {
      assertJsonEqual(
        options,
        { isolationLevel: "RepeatableRead", maxWait: 10_000, timeout: 60_000 },
        "la transaction garde son niveau d'isolation et ses bornes"
      );
      return callback(tx);
    },
  };

  return { calls, prisma };
}

function assertCurrentQueryContract(calls: Array<{ model: string; args: QueryArgs }>) {
  const firstRun = calls.slice(0, 7);
  assert.deepEqual(
    firstRun.map((call) => call.model),
    ["company", "user", "recurringOrder", "order", "invoice", "supportTicket", "operationJob"]
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
  assert.doesNotMatch(serialized, /authId|requestFingerprint|payload|lastError/);
  assertCurrentQueryContract(repository.calls);

  assert.equal(repository.calls.length, 14, "chaque export relit uniquement les sept modèles attendus");
});

test("une entreprise absente n'ouvre aucune autre catégorie", async () => {
  const repository = makeRepository();
  const service = loadService(repository.prisma);

  assert.equal(await service.exportCompanyData("company-missing"), null);
  assert.deepEqual(repository.calls.map((call) => call.model), ["company"]);
});
