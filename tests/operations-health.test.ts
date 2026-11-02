import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server";
import { reportOperationalIncident } from "../src/lib/operations/incident-reporter";

function load<T>(file: string, deps: Record<string, unknown>, globals: Record<string, unknown> = {}): T {
  const testModule = { exports: {} };
  const js = ts.transpileModule(readFileSync(resolve(file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(js, {
    Date,
    Error,
    Promise,
    URL,
    performance,
    process: { env: {} },
    exports: testModule.exports,
    module: testModule,
    require: (id: string) => {
      // DEMO-3 : la route cron passe aussi les factures en retard (testé dans demo3-cron-overdue).
      if (id === "@/domains/invoice/invoice-overdue.service" && !(id in deps)) return { markOverdueInvoices: async () => 0 };
      assert.ok(id in deps, `Unexpected dependency ${id}`);
      return deps[id];
    },
    ...globals,
  });
  return testModule.exports as T;
}

test("le signal d'incident retire secrets, URL de base et e-mail avant journal et webhook", async () => {
  const logs: string[] = [];
  const requests: Array<{ authorization: string | undefined; body: string }> = [];
  const result = await reportOperationalIncident({
    source: "cron\noperations",
    fingerprint: "worker-crash",
    summary: "Bearer very-secret-token postgresql://admin:pass@db.invalid/app ops@example.test",
    context: { failed: 2, detail: "sk-this-is-a-secret-value", "bad key": "ignored" },
  }, {
    env: {
      NODE_ENV: "test",
      OPS_ALERT_WEBHOOK_URL: "http://127.0.0.1:9999/hooks/private?token=hidden",
      OPS_ALERT_WEBHOOK_TOKEN: "webhook-secret",
    },
    now: new Date("2026-10-16T12:00:00.000Z"),
    log: { error: (value) => logs.push(String(value)), warn: (value) => logs.push(String(value)) },
    fetcher: async (_url, init) => {
      requests.push({
        authorization: new Headers(init?.headers).get("authorization") ?? undefined,
        body: String(init?.body),
      });
      return new Response(null, { status: 204 });
    },
  });

  assert.equal(result.webhook, "sent");
  assert.equal(requests[0]?.authorization, "Bearer webhook-secret");
  const emitted = `${logs.join(" ")} ${requests[0]?.body}`;
  for (const secret of ["very-secret-token", "admin:pass", "ops@example.test", "sk-this-is-a-secret-value", "token=hidden"]) {
    assert.equal(emitted.includes(secret), false, secret);
  }
  assert.equal(requests[0]?.body.includes("webhook-secret"), false);
});

test("une alerte part par e-mail, avec une clé par empreinte et par jour et un corps stable", async () => {
  const sent: Array<{ to: string; subject: string; text: string; idempotencyKey: string; replayWindowStart: unknown }> = [];
  const sendEmail = (async (input: (typeof sent)[number]) => {
    sent.push(input);
    return { status: "sent" };
  }) as never;
  const incident = (failed: number) => ({
    source: "cron.operations",
    fingerprint: "operation-jobs-overdue",
    summary: "Tâches en retard ops@example.test",
    severity: "error" as const,
    context: { failed },
  });
  const log = { error: () => undefined, warn: () => undefined };
  const env = { NODE_ENV: "test" as const, OPS_ALERT_RECIPIENT: " ops@tutelliv.test ", EMAIL_TEST_RECIPIENT: "recette@tutelliv.test" };

  const morning = await reportOperationalIncident(incident(1), { env, log, sendEmail, now: new Date("2026-11-02T08:00:00.000Z") });
  await reportOperationalIncident(incident(7), { env, log, sendEmail, now: new Date("2026-11-02T20:00:00.000Z") });
  await reportOperationalIncident(incident(7), { env, log, sendEmail, now: new Date("2026-11-03T00:05:00.000Z") });

  assert.equal(morning.email, "sent");
  assert.equal(sent[0]?.to, "ops@tutelliv.test");
  assert.equal(sent[0]?.idempotencyKey, "ops-alert:operation-jobs-overdue:2026-11-02");
  assert.equal(sent[0]?.replayWindowStart, null);
  // Même clé et même corps dans la journée : le fournisseur n'envoie qu'une fois ; nouvelle clé le lendemain.
  assert.deepEqual([sent[1]?.idempotencyKey, sent[1]?.subject, sent[1]?.text], [sent[0]?.idempotencyKey, sent[0]?.subject, sent[0]?.text]);
  assert.equal(sent[2]?.idempotencyKey, "ops-alert:operation-jobs-overdue:2026-11-03");
  assert.equal(`${sent[0]?.subject} ${sent[0]?.text}`.includes("ops@example.test"), false, "corps nettoyé");
});

test("sans destinataire, désactivé ou en échec, l'alerte e-mail ne bloque jamais l'appelant", async () => {
  const log = { error: () => undefined, warn: () => undefined };
  const incident = { source: "cron", fingerprint: "panne", summary: "Panne" };
  const noRecipient = await reportOperationalIncident(incident, { env: { NODE_ENV: "test" }, log });
  assert.equal(noRecipient.email, "disabled");

  const env = { NODE_ENV: "test" as const, EMAIL_TEST_RECIPIENT: "recette@tutelliv.test" };
  const off = await reportOperationalIncident(incident, { env, log, sendEmail: (async () => ({ status: "disabled" })) as never });
  assert.equal(off.email, "disabled");

  const warnings: string[] = [];
  const down = await reportOperationalIncident(incident, {
    env,
    log: { error: () => undefined, warn: (value) => warnings.push(String(value)) },
    sendEmail: (async () => { throw new Error("HTTP_500"); }) as never,
  });
  assert.equal(down.email, "failed");
  assert.match(warnings[0] ?? "", /tutelliv\.alert_email_failed/);
});

test("la santé profonde vérifie base, stockage et file sans révéler de donnée métier", async () => {
  let countCall = 0;
  const service = load<typeof import("../src/domains/operations/service-health.service")>(
    "src/domains/operations/service-health.service.ts",
    {
      "@/services/prisma/client": { prisma: {
        $queryRaw: async () => [{ value: 1 }],
        operationJob: { count: async () => countCall++ === 0 ? 0 : 0 },
      } },
      "@/lib/storage/pod": { checkPodStorageHealth: async () => undefined },
    },
    { process: { env: { CRON_SECRET: "configured" } } }
  );
  const result = await service.getServiceHealth(new Date("2026-10-16T12:00:00.000Z"));
  assert.equal(result.status, "ok");
  assert.equal(result.checks.database.status, "ok");
  assert.equal(result.checks.storage.status, "ok");
  assert.deepEqual(JSON.parse(JSON.stringify(result.checks.queue)), {
    status: "ok", durationMs: 0, failed: 0, stale: 0,
  });
  assert.equal(JSON.stringify(result).includes("configured"), false);
});

test("la route expose seulement la vie publiquement et protège le diagnostic profond", async () => {
  let deepCalls = 0;
  const route = load<typeof import("../src/app/api/health/route")>(
    "src/app/api/health/route.ts",
    {
      "next/server": { NextResponse },
      "@/domains/operations/service-health.service": {
        getServiceHealth: async () => {
          deepCalls += 1;
          return { status: "degraded", checks: { queue: { failed: 1 } } };
        },
      },
    },
    { Request, Response, process: { env: { OPS_HEALTH_SECRET: "health-secret" } } }
  );

  const live = await route.GET(new Request("https://test.invalid/api/health"));
  assert.equal(live.status, 200);
  assert.deepEqual(await live.json(), { status: "ok", service: "tutelliv" });
  assert.equal(deepCalls, 0);

  const denied = await route.GET(new Request("https://test.invalid/api/health?deep=1"));
  assert.equal(denied.status, 401);
  assert.equal(deepCalls, 0);

  const deep = await route.GET(new Request("https://test.invalid/api/health?deep=1", {
    headers: { authorization: "Bearer health-secret" },
  }));
  assert.equal(deep.status, 503);
  assert.equal(deepCalls, 1);
});

test("un échec terminal du worker rend le cron non sain et déclenche un incident", async () => {
  const incidents: Array<Record<string, unknown>> = [];
  const route = load<typeof import("../src/app/api/cron/operations/route")>(
    "src/app/api/cron/operations/route.ts",
    {
      "next/server": { NextResponse },
      "@/domains/operations/operation-job.service": {
        processDueOperationJobs: async () => ({ processed: 1, succeeded: 0, pending: 0, failed: 1 }),
      },
      "@/lib/operations/incident-reporter": {
        reportOperationalIncident: async (incident: Record<string, unknown>) => {
          incidents.push(incident);
          return { logged: true, webhook: "sent" };
        },
      },
    },
    { Request, Response, process: { env: { CRON_SECRET: "cron-secret" } } }
  );
  const response = await route.GET(new Request("https://test.invalid/api/cron/operations", {
    headers: { authorization: "Bearer cron-secret" },
  }));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).success, false);
  assert.equal(incidents.length, 1);
  assert.equal(incidents[0]?.fingerprint, "operation-jobs-terminal-failure");
});

test("des tâches PENDING en retard après le passage du filet déclenchent un incident et un 503", async () => {
  const incidents: Array<Record<string, unknown>> = [];
  const route = load<typeof import("../src/app/api/cron/operations/route")>(
    "src/app/api/cron/operations/route.ts",
    {
      "next/server": { NextResponse },
      "@/domains/operations/operation-job.service": {
        processDueOperationJobs: async () => ({ processed: 0, succeeded: 0, pending: 0, failed: 0, overdue: 3 }),
      },
      "@/lib/operations/incident-reporter": {
        reportOperationalIncident: async (incident: Record<string, unknown>) => {
          incidents.push(incident);
          return { logged: true, webhook: "sent" };
        },
      },
    },
    { Request, Response, process: { env: { CRON_SECRET: "cron-secret" } } }
  );
  const response = await route.GET(new Request("https://test.invalid/api/cron/operations", {
    headers: { authorization: "Bearer cron-secret" },
  }));
  assert.equal(response.status, 503);
  assert.equal(incidents.length, 1);
  assert.equal(incidents[0]?.fingerprint, "operation-jobs-overdue");
  assert.equal((incidents[0]?.context as Record<string, unknown>).overdue, 3);
});

test("un échec terminal et un retard simultanés produisent deux incidents distincts", async () => {
  const incidents: Array<Record<string, unknown>> = [];
  const route = load<typeof import("../src/app/api/cron/operations/route")>(
    "src/app/api/cron/operations/route.ts",
    {
      "next/server": { NextResponse },
      "@/domains/operations/operation-job.service": {
        processDueOperationJobs: async () => ({ processed: 1, succeeded: 0, pending: 0, failed: 1, overdue: 2 }),
      },
      "@/lib/operations/incident-reporter": {
        reportOperationalIncident: async (incident: Record<string, unknown>) => {
          incidents.push(incident);
          return { logged: true, webhook: "sent" };
        },
      },
    },
    { Request, Response, process: { env: { CRON_SECRET: "cron-secret" } } }
  );
  const response = await route.GET(new Request("https://test.invalid/api/cron/operations", {
    headers: { authorization: "Bearer cron-secret" },
  }));
  assert.equal(response.status, 503);
  assert.deepEqual(
    incidents.map((incident) => incident.fingerprint).sort(),
    ["operation-jobs-overdue", "operation-jobs-terminal-failure"]
  );
});

test("la route cron déclare une durée maximale explicite alignée sur le délai du workflow", () => {
  const source = readFileSync(resolve("src/app/api/cron/operations/route.ts"), "utf8");
  const workflow = readFileSync(resolve(".github/workflows/cron-operations.yml"), "utf8");
  const maxDuration = Number(/export const maxDuration = (\d+);/.exec(source)?.[1]);
  const maxTime = Number(/--max-time (\d+)/.exec(workflow)?.[1]);
  assert.ok(maxDuration >= 30);
  assert.ok(maxTime >= maxDuration);
  assert.doesNotMatch(workflow, /--retry\s+\d/);
  assert.doesNotMatch(workflow, /--retry-all-errors/);
});

test("sans tâche en retard ni échec, le filet cron répond 200 sans incident", async () => {
  const incidents: Array<Record<string, unknown>> = [];
  const route = load<typeof import("../src/app/api/cron/operations/route")>(
    "src/app/api/cron/operations/route.ts",
    {
      "next/server": { NextResponse },
      "@/domains/operations/operation-job.service": {
        processDueOperationJobs: async () => ({ processed: 0, succeeded: 0, pending: 0, failed: 0, overdue: 0 }),
      },
      "@/lib/operations/incident-reporter": {
        reportOperationalIncident: async (incident: Record<string, unknown>) => {
          incidents.push(incident);
          return { logged: true, webhook: "sent" };
        },
      },
    },
    { Request, Response, process: { env: { CRON_SECRET: "cron-secret" } } }
  );
  const response = await route.GET(new Request("https://test.invalid/api/cron/operations", {
    headers: { authorization: "Bearer cron-secret" },
  }));
  assert.equal(response.status, 200);
  assert.equal(incidents.length, 0);
});

test("une erreur de requête non gérée produit un incident sans chemin réel ni en-têtes", async () => {
  const incidents: Array<Record<string, unknown>> = [];
  const instrumentation = load<typeof import("../src/instrumentation")>(
    "src/instrumentation.ts",
    {
      "@/lib/operations/incident-reporter": {
        reportOperationalIncident: async (incident: Record<string, unknown>) => {
          incidents.push(incident);
          return { logged: true, webhook: "disabled" };
        },
      },
    }
  );
  await instrumentation.onRequestError(
    new Error("private failure detail"),
    { path: "/api/orders/private-id", method: "GET", headers: { cookie: "private-cookie" } },
    { routerKind: "App Router", routePath: "/api/orders/[id]", routeType: "route", revalidateReason: undefined }
  );
  assert.equal(incidents.length, 1);
  assert.equal(incidents[0]?.summary, "Une requête applicative non gérée a échoué.");
  const serialized = JSON.stringify(incidents[0]);
  assert.equal(serialized.includes("private-id"), false);
  assert.equal(serialized.includes("private-cookie"), false);
  assert.equal(serialized.includes("private failure detail"), false);
  assert.equal(serialized.includes("/api/orders/[id]"), true);
});

test("OPS-03B : la migration du moniteur garde secrets et journal hors Data API", () => {
  const migration = readFileSync(resolve(
    "prisma/migrations/20261023191000_ops03b_monitor/migration.sql"
  ), "utf8");
  assert.match(migration, /CREATE SCHEMA IF NOT EXISTS ops_monitor/);
  assert.match(migration, /vault\.decrypted_secrets/);
  assert.match(migration, /REVOKE ALL ON FUNCTION ops_monitor\.run\(BOOLEAN\) FROM PUBLIC, anon, authenticated/);
  assert.match(migration, /x-vercel-protection-bypass/);
  assert.match(migration, /idempotency-key/);
  assert.match(migration, /INTERVAL '2 hours'/);
  assert.match(migration, /INTERVAL '90 days'/);
  assert.doesNotMatch(migration, /https:\/\//);
  assert.doesNotMatch(migration, /sk[-_][A-Za-z0-9]/);
});

test("OPS-03B : le cron reste inactif tant que la reprise n'est pas validée", () => {
  const rehearsal = readFileSync(resolve(
    "scripts/ops03b/rehearse-preproduction.ts"
  ), "utf8");
  const recoveryAssertion = rehearsal.indexOf("OPS03B_RECOVERY_ALERT_NOT_SENT");
  const scheduleActivation = rehearsal.indexOf("SELECT cron.schedule");
  assert.ok(recoveryAssertion >= 0);
  assert.ok(scheduleActivation > recoveryAssertion);
});
