import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";

type Row = Record<string, unknown>;

function loadService(calls: string[], options: { failInvoice?: "permanent" | "transient" } = {}) {
  const job: Row = {
    id: "job-1",
    jobKey: "",
    type: "CLIENT_NOTIFICATION",
    status: "PENDING",
    payload: {},
    attempts: 0,
    maxAttempts: 3,
    nextAttemptAt: new Date("2026-10-28T09:00:00.000Z"),
    lockedAt: null,
    lastError: null,
  };
  const prisma = {
    operationJob: {
      findUnique: async () => ({ ...job }),
      findUniqueOrThrow: async () => ({ ...job }),
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        if (where.status && where.status !== job.status) return { count: 0 };
        for (const [key, value] of Object.entries(data)) {
          job[key] = value && typeof value === "object" && "increment" in (value as Row)
            ? (job[key] as number) + ((value as { increment: number }).increment)
            : value;
        }
        return { count: 1 };
      },
    },
  };
  const deps: Record<string, unknown> = {
    "@/services/prisma/client": { prisma },
    "@/lib/operations/after-response": { runAfterResponse: () => undefined },
    "@/domains/saas/saas.service": { assertSaasMutationFeature: async () => ({}) },
    "@/domains/client-portal/notify.service": {
      deliverClientNotificationJob: async () => { calls.push("notify"); },
    },
    "@/domains/invoice/invoice-reminder.service": {
      deliverInvoiceReminderJob: async (payload: Row, key: string) => { calls.push(`reminder:${payload.reminderId}:${key}`); },
    },
    "@/domains/invoice/delivery-invoice.service": {
      runDeliveryInvoiceJob: async (payload: Row) => {
        calls.push(`delivery-invoice:${payload.orderId}`);
        if (options.failInvoice === "permanent") throw Object.assign(new Error("DELIVERY_INVOICE_EMPTY"), { permanent: true });
        if (options.failInvoice === "transient") throw new Error("connexion perdue");
      },
    },
  };
  const loaded = { exports: {} as typeof import("../src/domains/operations/operation-job.service") };
  const js = ts.transpileModule(readFileSync(resolve("src/domains/operations/operation-job.service.ts"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(js, {
    Date, Error, Object, Promise, Set, console: { error: () => undefined },
    exports: loaded.exports, module: loaded,
    require: (id: string) => {
      assert.ok(id in deps, `Unexpected dependency ${id}`);
      return deps[id];
    },
  });
  return { service: loaded.exports, job };
}

test("DEMO-3 tâches : une relance de facture part par son propre traitement", async () => {
  const calls: string[] = [];
  const { service, job } = loadService(calls);
  job.jobKey = "client-notification:invoice-reminder:rem_1";
  job.payload = { kind: "INVOICE_REMINDER", reminderId: "rem_1", companyId: "company_a" };

  const result = await service.processOperationJob("job-1", new Date("2026-10-28T10:00:00.000Z"));

  assert.deepEqual(calls, ["reminder:rem_1:client-notification:invoice-reminder:rem_1"]);
  assert.equal(result?.status, "SUCCEEDED");
});

test("DEMO-3 tâches : la facture à la livraison a son propre type et une erreur permanente n'est pas relancée", async () => {
  const calls: string[] = [];
  const { service, job } = loadService(calls, { failInvoice: "permanent" });
  job.type = "DELIVERY_INVOICE";
  job.jobKey = "delivery-invoice:order_1:evt_1";
  job.payload = { orderId: "order_1", companyId: "company_a" };

  const result = await service.processOperationJob("job-1", new Date("2026-10-28T10:00:00.000Z"));

  assert.deepEqual(calls, ["delivery-invoice:order_1"]);
  assert.equal(result?.status, "FAILED", "échec définitif dès la première tentative");
  assert.equal(result?.attempts, 1);
  assert.equal(result?.lastError, "DELIVERY_INVOICE_EMPTY", "erreur visible sur la tâche");
});

test("DEMO-3 tâches : une erreur passagère de la facture à la livraison est rejouée", async () => {
  const calls: string[] = [];
  const { service, job } = loadService(calls, { failInvoice: "transient" });
  job.type = "DELIVERY_INVOICE";
  job.payload = { orderId: "order_1", companyId: "company_a" };
  const result = await service.processOperationJob("job-1", new Date("2026-10-28T10:00:00.000Z"));
  assert.equal(result?.status, "PENDING");
  assert.equal(result?.lastError, "connexion perdue");
});
