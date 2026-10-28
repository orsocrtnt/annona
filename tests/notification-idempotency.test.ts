import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as podEvidence from "../src/domains/delivery/pod-evidence";

type Row = Record<string, unknown>;

function load<T>(deps: Record<string, unknown>, context: Record<string, unknown>): T {
  const module = { exports: {} };
  const js = ts.transpileModule(
    readFileSync(resolve("src/domains/client-portal/notify.service.ts"), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
  ).outputText;
  runInNewContext(js, {
    Date,
    Error,
    Intl,
    Promise,
    console: { error: () => undefined },
    exports: module.exports,
    module,
    ...context,
    require: (id: string) => {
      assert.ok(id in deps, `Unexpected dependency ${id}`);
      return deps[id];
    },
  });
  return module.exports as T;
}

function fixture(settings?: {
  deliveryAlerts?: boolean;
  invoiceAlerts?: boolean;
  emailNotifications?: boolean;
}, options?: { companySettings?: unknown; appUrl?: string }) {
  const notifications = new Map<string, Row>();
  const emails: Array<{ idempotencyKey: string | null; body: string }> = [];
  const providerDeliveries = new Map<string, string>();
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
          ? { email: "client@example.test" }
          : null,
    },
    delivery: {
      findFirst: async ({ where }: { where: { id: string; customerId: string; companyId: string } }) =>
        where.id === "delivery-a" &&
        where.customerId === "client-a" &&
        where.companyId === "company-a"
          ? { id: where.id, company: { settings: options?.companySettings ?? {} } }
          : null,
    },
    invoice: {
      findFirst: async () => null,
    },
  };

  const enqueueOperationJob = async (_db: unknown, input: Row) => {
    const key = input.jobKey as string;
    if (!jobs.has(key)) jobs.set(key, { id: `job-${jobs.size + 1}`, ...input });
    return jobs.get(key);
  };

  const service = load<typeof import("../src/domains/client-portal/notify.service")>(
    {
      "node:crypto": { createHash },
      "@/lib/query/list-limits": { CLIENT_NOTIFICATIONS_TAKE: 100 },
      "@/domains/operations/operation-job.service": {
        enqueueOperationJob,
        kickOperationJob: () => undefined,
      },
      "@/lib/email/transactional-email": {
        getTransactionalEmailConfiguration: () => ({ enabled: true }),
        sendTransactionalEmail: async (input: {
          idempotencyKey: string;
          to: string;
          subject: string;
          text: string;
        }) => {
          emails.push({
            idempotencyKey: input.idempotencyKey,
            body: JSON.stringify(input),
          });
          if (!providerDeliveries.has(input.idempotencyKey)) {
            providerDeliveries.set(input.idempotencyKey, JSON.stringify(input));
          }
        },
      },
      "@/services/prisma/client": { prisma },
      "@/domains/delivery/pod-evidence": podEvidence,
      "./settings.service": {
        getClientSettings: async () => ({
          deliveryAlerts: settings?.deliveryAlerts ?? true,
          invoiceAlerts: settings?.invoiceAlerts ?? true,
          emailNotifications: settings?.emailNotifications ?? true,
        }),
      },
    },
    {
      process: { env: options?.appUrl ? { NEXT_PUBLIC_APP_URL: options.appUrl } : {} },
    }
  );

  return { service, notifications, emails, providerDeliveries, jobs, prisma };
}

const payload = {
  kind: "DELIVERY" as const,
  customerId: "client-a",
  companyId: "company-a",
  status: "DELIVERED" as const,
  reference: "LIV-TEST",
  deliveryId: "delivery-a",
};

test("rejouer une notification conserve une ligne et la même clé fournisseur", async () => {
  const f = fixture();
  const eventKey = "client-notification:delivery:delivery-a:event-a";

  await f.service.deliverClientNotificationJob(payload, eventKey);
  await f.service.deliverClientNotificationJob(payload, eventKey);

  assert.equal(f.notifications.size, 1);
  assert.equal(f.emails.length, 2);
  assert.deepEqual(
    [...new Set(f.emails.map((email) => email.idempotencyKey))],
    [eventKey]
  );
  assert.equal(f.emails[0]?.body, f.emails[1]?.body);
  assert.equal(f.providerDeliveries.size, 1);
  assert.equal(f.providerDeliveries.get(eventKey), f.emails[0]?.body);
});

test("une notification ne traverse pas la frontière d'entreprise", async () => {
  const f = fixture();
  await f.service.deliverClientNotificationJob(
    { ...payload, companyId: "company-b" },
    "client-notification:delivery:delivery-a:event-b"
  );

  assert.equal(f.notifications.size, 0);
  assert.equal(f.emails.length, 0);
});

test("les préférences désactivent l'alerte entière ou seulement sa copie e-mail", async () => {
  const muted = fixture({ deliveryAlerts: false });
  await muted.service.deliverClientNotificationJob(
    payload,
    "client-notification:delivery:delivery-a:muted"
  );
  assert.equal(muted.notifications.size, 0);
  assert.equal(muted.emails.length, 0);

  const inAppOnly = fixture({ emailNotifications: false });
  await inAppOnly.service.deliverClientNotificationJob(
    payload,
    "client-notification:delivery:delivery-a:in-app"
  );
  assert.equal(inAppOnly.notifications.size, 1);
  assert.equal(inAppOnly.emails.length, 0);
});

test("deux transitions légitimes vers le même statut ont deux tâches, un rejeu garde la même", async () => {
  const f = fixture();
  const base = {
    customerId: "client-a",
    companyId: "company-a",
    status: "ASSIGNED" as const,
    reference: "LIV-TEST",
    deliveryId: "delivery-a",
  };

  const first = await f.service.queueDeliveryStatusNotification(f.prisma as never, {
    ...base,
    eventId: "event-1",
  });
  const replay = await f.service.queueDeliveryStatusNotification(f.prisma as never, {
    ...base,
    eventId: "event-1",
  });
  const secondTransition = await f.service.queueDeliveryStatusNotification(f.prisma as never, {
    ...base,
    eventId: "event-2",
  });

  assert.equal(first?.id, replay?.id);
  assert.notEqual(first?.id, secondTransition?.id);
  assert.equal(f.jobs.size, 2);
});

test("preuve de livraison : livrée ou en échec, l'e-mail porte le lien du portail et la clé d'idempotence de l'événement", async () => {
  for (const status of ["DELIVERED", "FAILED"] as const) {
    const f = fixture(undefined, { appUrl: "https://app.tutelliv.test" });
    const eventKey = `client-notification:delivery:delivery-a:${status}`;
    await f.service.deliverClientNotificationJob({ ...payload, status }, eventKey);
    assert.equal(f.emails.length, 1);
    assert.equal(f.emails[0]?.idempotencyKey, eventKey);
    assert.match(f.emails[0]!.body, /https:\/\/app\.tutelliv\.test\/portal\/deliveries\/delivery-a/);
    assert.equal(f.notifications.size, 1);
  }
});

test("preuve de livraison : l'entreprise coupe seulement le lien de preuve ; l'e-mail de statut part toujours", async () => {
  for (const status of ["DELIVERED", "FAILED"] as const) {
    const f = fixture(undefined, { companySettings: { proofRules: { emailToClient: false } }, appUrl: "https://app.tutelliv.test" });
    await f.service.deliverClientNotificationJob({ ...payload, status }, `client-notification:delivery:delivery-a:off-${status}`);
    assert.equal(f.emails.length, 1, "l'information de livraison n'est pas supprimée");
    assert.doesNotMatch(f.emails[0]!.body, /https?:/);
    assert.equal(f.notifications.size, 1);
  }
});

test("preuve de livraison : le coupe-circuit de l'entreprise ne concerne pas les autres statuts", async () => {
  const f = fixture(undefined, { companySettings: { proofRules: { emailToClient: false } } });
  await f.service.deliverClientNotificationJob({ ...payload, status: "IN_DELIVERY" }, "client-notification:delivery:delivery-a:transit");
  assert.equal(f.emails.length, 1);
});

test("preuve de livraison : sans URL d'application, le message part sans lien (aucun lien inventé)", async () => {
  const f = fixture();
  await f.service.deliverClientNotificationJob(payload, "client-notification:delivery:delivery-a:nolink");
  assert.equal(f.emails.length, 1);
  assert.doesNotMatch(f.emails[0]!.body, /https?:/);
});
