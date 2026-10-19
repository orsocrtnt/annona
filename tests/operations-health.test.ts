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
