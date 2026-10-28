import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as podEvidence from "../src/domains/delivery/pod-evidence";

type Row = Record<string, unknown>;

function load<T>(file: string, deps: Record<string, unknown>, context: Record<string, unknown> = {}): T {
  const module = { exports: {} };
  runInNewContext(ts.transpileModule(readFileSync(resolve(file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { Date, Math, Error, Intl, Promise, console, exports: module.exports, module, process: { env: {} }, ...context,
    require: (id: string) => { assert.ok(id in deps, id); return deps[id]; } });
  return module.exports as T;
}

type NotifyService = typeof import("../src/domains/client-portal/notify.service");
const acceptedAt = new Date("2026-10-28T10:05:00.000Z");

function notifyFixture(options: {
  settings?: { deliveryAlerts?: boolean; emailNotifications?: boolean };
  userEmail?: string | null;
  missionAcceptedAt?: Date | null;
} = {}) {
  const notifications = new Map<string, Row>();
  const emails: Array<{ to: string; subject: string; text: string; idempotencyKey: string }> = [];
  const jobs = new Map<string, Row>();
  const prisma = {
    clientNotification: {
      upsert: async ({ where, create }: { where: { id: string }; create: Row }) => {
        if (!notifications.has(where.id)) notifications.set(where.id, create);
        return notifications.get(where.id);
      },
      findMany: async () => [],
      deleteMany: async () => ({ count: 0 }),
    },
    user: {
      findFirst: async ({ where }: { where: { id: string; companyId: string } }) =>
        where.id === "client-a" && where.companyId === "company-a"
          ? { email: options.userEmail === undefined ? "client@example.test" : options.userEmail }
          : null,
    },
    delivery: {
      findFirst: async ({ where }: { where: Row }) =>
        where.id === "delivery-a" && where.customerId === "client-a" && where.companyId === "company-a"
          ? { id: "delivery-a", missionAcceptedAt: options.missionAcceptedAt === undefined ? acceptedAt : options.missionAcceptedAt, company: { settings: {} } }
          : null,
    },
    invoice: { findFirst: async () => null },
    operationJob: {},
  };
  const enqueueOperationJob = async (_db: unknown, input: Row) => {
    const key = input.jobKey as string;
    if (!jobs.has(key)) jobs.set(key, { id: `job-${jobs.size + 1}`, ...input });
    return jobs.get(key);
  };
  const service = load<NotifyService>("src/domains/client-portal/notify.service.ts", {
    "node:crypto": { createHash },
    "@/lib/query/list-limits": { CLIENT_NOTIFICATIONS_TAKE: 100 },
    "@/domains/operations/operation-job.service": { enqueueOperationJob, kickOperationJob: () => undefined },
    "@/lib/email/transactional-email": {
      getTransactionalEmailConfiguration: () => ({ enabled: true }),
      sendTransactionalEmail: async (input: { to: string; subject: string; text: string; idempotencyKey: string }) => { emails.push(input); },
    },
    "@/services/prisma/client": { prisma },
    "@/domains/delivery/pod-evidence": podEvidence,
    "./settings.service": {
      getClientSettings: async () => ({
        deliveryAlerts: options.settings?.deliveryAlerts ?? true,
        invoiceAlerts: true,
        emailNotifications: options.settings?.emailNotifications ?? true,
      }),
    },
  });
  return { service, notifications, emails, jobs, prisma };
}

const queueInput = { customerId: "client-a", companyId: "company-a", reference: "LIV-1038", deliveryId: "delivery-a", acceptedAt };

test("prise en charge : une tâche durable par acceptation, rejouée sans doublon", async () => {
  const f = notifyFixture();
  const first = await f.service.queueDeliveryAcceptedNotification(f.prisma as never, queueInput);
  const replay = await f.service.queueDeliveryAcceptedNotification(f.prisma as never, queueInput);
  assert.equal(first?.id, replay?.id);
  assert.equal(f.jobs.size, 1);
  const job = [...f.jobs.values()][0]!;
  assert.equal(job.type, "CLIENT_NOTIFICATION");
  assert.equal(job.jobKey, "client-notification:delivery:delivery-a:accepted:2026-10-28T10:05:00.000Z");
  assert.equal((job.payload as Row).kind, "DELIVERY_ACCEPTED");
  // Refus puis nouvelle acceptation : un nouvel événement légitime.
  await f.service.queueDeliveryAcceptedNotification(f.prisma as never, { ...queueInput, acceptedAt: new Date(+acceptedAt + 60_000) });
  assert.equal(f.jobs.size, 2);
  assert.equal(await f.service.queueDeliveryAcceptedNotification(f.prisma as never, { ...queueInput, customerId: null }), null, "sans donneur d'ordre : aucune tâche");
});

const job = { kind: "DELIVERY_ACCEPTED", customerId: "client-a", companyId: "company-a", reference: "LIV-1038", deliveryId: "delivery-a", acceptedAt: acceptedAt.toISOString() };
const eventKey = "client-notification:delivery:delivery-a:accepted:2026-10-28T10:05:00.000Z";

test("prise en charge : notification dans l'application et e-mail, rejouées sans doublon", async () => {
  const f = notifyFixture();
  await f.service.deliverClientNotificationJob(job, eventKey);
  await f.service.deliverClientNotificationJob(job, eventKey);
  assert.equal(f.notifications.size, 1);
  const row = [...f.notifications.values()][0]!;
  assert.equal(row.title, "Prise en charge");
  assert.match(String(row.body), /LIV-1038/);
  assert.match(String(row.body), /pris en charge/);
  assert.equal(row.href, "/portal/deliveries/delivery-a");
  assert.equal(row.type, "DELIVERY");
  assert.deepEqual([...new Set(f.emails.map((e) => e.idempotencyKey))], [eventKey], "même clé fournisseur au rejeu");
  assert.equal(f.emails[0]?.to, "client@example.test");
  assert.equal(f.emails[0]?.subject, "Prise en charge", "sujet au format des e-mails de statut (titre seul)");
  assert.equal(f.emails[0]?.text, row.body);
  assert.doesNotMatch(JSON.stringify([...f.notifications.values(), ...f.emails]), /latitude|longitude|\d+[,.]\d+\s?km/);
});

test("prise en charge : client sans e-mail → notification dans l'application seulement", async () => {
  const f = notifyFixture({ userEmail: null });
  await f.service.deliverClientNotificationJob(job, eventKey);
  assert.equal(f.notifications.size, 1);
  assert.equal(f.emails.length, 0);
});

test("prise en charge : préférences du portail respectées", async () => {
  const muted = notifyFixture({ settings: { deliveryAlerts: false } });
  await muted.service.deliverClientNotificationJob(job, eventKey);
  assert.equal(muted.notifications.size, 0);
  assert.equal(muted.emails.length, 0);
  const inApp = notifyFixture({ settings: { emailNotifications: false } });
  await inApp.service.deliverClientNotificationJob(job, eventKey);
  assert.equal(inApp.notifications.size, 1);
  assert.equal(inApp.emails.length, 0);
});

test("prise en charge : acceptation retirée ou remplacée avant l'envoi → rien n'est envoyé", async () => {
  for (const missionAcceptedAt of [null, new Date(+acceptedAt + 60_000)]) {
    const f = notifyFixture({ missionAcceptedAt });
    await f.service.deliverClientNotificationJob(job, eventKey);
    assert.equal(f.notifications.size, 0);
    assert.equal(f.emails.length, 0);
  }
});

test("prise en charge : aucune notification hors de l'entreprise ou pour un autre client", async () => {
  const f = notifyFixture();
  await f.service.deliverClientNotificationJob({ ...job, companyId: "company-b" }, `${eventKey}:b`);
  await f.service.deliverClientNotificationJob({ ...job, customerId: "client-b" }, `${eventKey}:c`);
  assert.equal(f.notifications.size, 0);
  await assert.rejects(f.service.deliverClientNotificationJob({ ...job, acceptedAt: "pas une date" }, `${eventKey}:d`), /CLIENT_NOTIFICATION_PAYLOAD_INVALID/);
});

test("affectation : le libellé ne parle plus de prise en charge (réservée à l'acceptation du livreur)", async () => {
  const f = notifyFixture();
  await f.service.deliverClientNotificationJob({ kind: "DELIVERY", customerId: "client-a", companyId: "company-a", status: "ASSIGNED", reference: "LIV-1038", deliveryId: "delivery-a" }, "client-notification:delivery:delivery-a:event-1");
  const row = [...f.notifications.values()][0]!;
  assert.equal(row.title, "Chauffeur assigné");
  assert.doesNotMatch(String(row.body), /pris en charge/);
});

// --- Acceptation par le livreur ---------------------------------------------------------

const initialVersion = new Date("2026-10-09T09:00:00.000Z");
function ackFixture(options: { failEvent?: boolean; customerId?: string | null } = {}) {
  let row: Row = { id: "delivery", companyId: "company", orderId: "order", customerId: options.customerId === undefined ? "client" : options.customerId, reference: "LIV-1038", driverId: "driver", driverName: "Test Chauffeur", status: "ASSIGNED", missionStartedAt: null, missionAcceptedAt: null, updatedAt: initialVersion };
  let events: Row[] = [];
  let jobs: Row[] = [];
  const kicked: string[] = [];
  const same = (a: unknown, b: unknown) => a instanceof Date && b instanceof Date ? +a === +b : a === b;
  const matches = (where: Row) => Object.entries(where).every(([key, value]) => same(row[key], value));
  const tx = {
    delivery: {
      findFirst: async ({ where }: { where: Row }) => matches(where) ? { ...row } : null,
      findUniqueOrThrow: async () => ({ ...row }),
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        if (!matches(where)) return { count: 0 };
        row = { ...row, ...data }; return { count: 1 };
      },
    },
    order: { updateMany: async () => ({ count: 1 }) },
    trackingEvent: { create: async ({ data }: { data: Row }) => { if (options.failEvent) throw new Error("EVENT_FAILURE"); events.push(data); return data; } },
  };
  let queue = Promise.resolve();
  const prisma = { ...tx, $transaction: <T>(fn: (transaction: typeof tx) => Promise<T>) => {
    const result = queue.then(async () => {
      const saved = { row: { ...row }, events: [...events], jobs: [...jobs] };
      try { return await fn(tx); } catch (error) { row = saved.row; events = saved.events; jobs = saved.jobs; throw error; }
    });
    queue = result.then(() => undefined, () => undefined); return result;
  } };
  const { acknowledgeDeliveryMissionByDriver: acknowledge } = load<{
    acknowledgeDeliveryMissionByDriver: (driver: string, company: string, id: string, input: { action: "accept" | "decline"; expectedUpdatedAt: Date; reason?: string }) => Promise<Row | null>;
  }>("src/domains/delivery/acknowledge-delivery-mission.service.ts", {
    "@/services/prisma/client": { prisma },
    "@/domains/client-portal/notify.service": {
      queueDeliveryAcceptedNotification: async (db: unknown, input: Row) => {
        assert.equal(db, tx, "la tâche est créée dans la transaction de l'acceptation");
        if (!input.customerId) return null;
        const job = { id: `job-${jobs.length + 1}`, ...input };
        jobs.push(job); return job;
      },
    },
    "@/domains/operations/operation-job.service": { kickOperationJob: (id: string) => { kicked.push(id); } },
  });
  return { acknowledge, row: () => row, jobs: () => jobs, kicked };
}
const accept = { action: "accept" as const, expectedUpdatedAt: initialVersion };

test("acceptation : une tâche de notification dans la transaction, lancée après validation", async () => {
  const f = ackFixture();
  const result = await f.acknowledge("driver", "company", "delivery", accept);
  assert.equal(f.jobs().length, 1);
  const queued = f.jobs()[0]!;
  assert.equal(queued.customerId, "client");
  assert.equal(queued.companyId, "company");
  assert.equal(queued.deliveryId, "delivery");
  assert.equal(queued.reference, "LIV-1038");
  assert.equal(+(queued.acceptedAt as Date), +(result!.missionAcceptedAt as Date));
  assert.deepEqual(f.kicked, ["job-1"]);
  assert.equal(result!.id, "delivery", "la route reçoit toujours la livraison");
});

test("acceptation : rejeu et double clic concurrent → une seule tâche", async () => {
  const f = ackFixture();
  const first = await f.acknowledge("driver", "company", "delivery", accept);
  await f.acknowledge("driver", "company", "delivery", { ...accept, expectedUpdatedAt: first!.updatedAt as Date });
  assert.equal(f.jobs().length, 1);
  assert.equal(f.kicked.length, 1);
  const g = ackFixture();
  await Promise.allSettled([g.acknowledge("driver", "company", "delivery", accept), g.acknowledge("driver", "company", "delivery", accept)]);
  assert.equal(g.jobs().length, 1);
  assert.equal(g.kicked.length, 1);
});

test("acceptation : refus, échec ou livraison sans client → aucune notification", async () => {
  const declined = ackFixture();
  await declined.acknowledge("driver", "company", "delivery", { action: "decline", expectedUpdatedAt: initialVersion, reason: "Indisponible" });
  assert.equal(declined.jobs().length, 0);
  assert.equal(declined.kicked.length, 0);
  const failed = ackFixture({ failEvent: true });
  await assert.rejects(failed.acknowledge("driver", "company", "delivery", accept), /EVENT_FAILURE/);
  assert.equal(failed.jobs().length, 0);
  assert.equal(failed.kicked.length, 0);
  const orphan = ackFixture({ customerId: null });
  const result = await orphan.acknowledge("driver", "company", "delivery", accept);
  assert.ok(result?.missionAcceptedAt);
  assert.equal(orphan.kicked.length, 0);
});

test("acceptation : autre entreprise ou autre livreur → ni mission ni notification", async () => {
  const f = ackFixture();
  assert.equal(await f.acknowledge("driver", "foreign", "delivery", accept), null);
  assert.equal(await f.acknowledge("other", "company", "delivery", accept), null);
  assert.equal(f.jobs().length, 0);
});
