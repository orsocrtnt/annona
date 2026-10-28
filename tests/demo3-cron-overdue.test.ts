import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server";

type Incident = Record<string, unknown>;

function loadCron(sweep: () => Promise<number>, incidents: Incident[], jobs: Record<string, number> | (() => Promise<never>) = { processed: 0, succeeded: 0, pending: 0, failed: 0, overdue: 0 }) {
  const testModule = { exports: {} as { GET: (request: Request) => Promise<Response> } };
  const js = ts.transpileModule(readFileSync(resolve("src/app/api/cron/operations/route.ts"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const deps: Record<string, unknown> = {
    "next/server": { NextResponse },
    "@/domains/operations/operation-job.service": { processDueOperationJobs: typeof jobs === "function" ? jobs : async () => jobs },
    "@/domains/invoice/invoice-overdue.service": { markOverdueInvoices: sweep },
    "@/lib/operations/incident-reporter": {
      reportOperationalIncident: async (incident: Incident) => {
        incidents.push(incident);
        return { logged: true, webhook: "sent" };
      },
    },
  };
  runInNewContext(js, {
    Date, Error, Promise, Request, Response,
    process: { env: { CRON_SECRET: "cron-secret" } },
    exports: testModule.exports,
    module: testModule,
    require: (id: string) => {
      assert.ok(id in deps, `Unexpected dependency ${id}`);
      return deps[id];
    },
  });
  return testModule.exports;
}

const authorized = () => new Request("https://test.invalid/api/cron/operations", { headers: { authorization: "Bearer cron-secret" } });

test("DEMO-3 cron : le filet d'opérations passe aussi les factures échues en retard", async () => {
  const incidents: Incident[] = [];
  let sweeps = 0;
  const route = loadCron(async () => { sweeps += 1; return 2; }, incidents);

  const response = await route.GET(authorized());

  assert.equal(response.status, 200);
  assert.equal(sweeps, 1);
  assert.equal((await response.json()).data.overdueInvoices, 2);
  assert.equal(incidents.length, 0);
});

test("DEMO-3 cron : sans secret, aucune facture n'est touchée", async () => {
  let sweeps = 0;
  const route = loadCron(async () => { sweeps += 1; return 0; }, []);
  const response = await route.GET(new Request("https://test.invalid/api/cron/operations"));
  assert.equal(response.status, 401);
  assert.equal(sweeps, 0);
});

test("DEMO-3 cron : un échec du passage en retard est signalé sans bloquer les tâches durables", async () => {
  const incidents: Incident[] = [];
  const route = loadCron(async () => { throw new Error("db down"); }, incidents, { processed: 3, succeeded: 3, pending: 0, failed: 0, overdue: 0 });

  const response = await route.GET(authorized());

  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.data.processed, 3, "les tâches ont bien été traitées");
  assert.equal(body.data.overdueInvoices, null);
  assert.deepEqual(incidents.map((incident) => incident.fingerprint), ["invoice-overdue-sweep-failure"]);
});

test("DEMO-3 cron : le passage en retard s'exécute même si le traitement des tâches plante", async () => {
  const incidents: Incident[] = [];
  let sweeps = 0;
  const route = loadCron(async () => { sweeps += 1; return 1; }, incidents, async () => { throw new Error("worker down"); });

  const response = await route.GET(authorized());

  assert.equal(sweeps, 1);
  assert.equal(response.status, 500);
  assert.deepEqual(incidents.map((incident) => incident.fingerprint), ["operation-jobs-worker-crash"]);
});
