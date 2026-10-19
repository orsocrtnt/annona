import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server";
import {
  cleanupExpiredDemoSessions,
} from "../src/domains/data-lifecycle/demo-cleanup-batch.service";
import {
  DEMO_CLEANUP_AUTHORIZATION,
} from "../src/domains/data-lifecycle/demo-cleanup.service";

test("le lot est borné, ancienneté d'abord et ne retourne aucun identifiant", async () => {
  const rows = Array.from({ length: 101 }, (_, index) => ({ id: `company-${index}` }));
  let capturedTake: number | undefined;
  let capturedOrderBy: unknown;
  const visited: string[] = [];
  const result = await cleanupExpiredDemoSessions(
    {
      now: new Date("2026-10-18T12:00:00.000Z"),
    },
    {
      findCompanies: async (input) => {
        capturedTake = input.take;
        capturedOrderBy = input.orderBy;
        return rows;
      },
      cleanupSession: async (id) => {
        visited.push(id);
        return id === "company-4"
          ? { status: "blocked", reason: "STORAGE_OBJECTS_PRESENT" }
          : { status: "eligible" };
      },
    }
  );

  assert.equal(visited.length, 100);
  assert.deepEqual(visited.slice(0, 2), ["company-0", "company-1"]);
  assert.equal(result.processed, 100);
  assert.equal(result.remaining, true);
  assert.equal(result.success, false);
  assert.equal(result.counts.blocked, 1);
  assert.equal(result.reasons.STORAGE_OBJECTS_PRESENT, 1);
  assert.ok(!JSON.stringify(result).includes("company-"));
  assert.equal(capturedTake, 101);
  assert.deepEqual(capturedOrderBy, [{ createdAt: "asc" }, { id: "asc" }]);
});

test("le lot appliqué exige l'autorisation explicite avant toute lecture", async () => {
  let reads = 0;
  await assert.rejects(
    cleanupExpiredDemoSessions(
      { apply: true },
      {
        findCompanies: async () => {
          reads += 1;
          return [];
        },
      }
    ),
    /EXPLICIT_ACTIVATION_REQUIRED/
  );
  assert.equal(reads, 0);

  const result = await cleanupExpiredDemoSessions(
    {
      apply: true,
      authorization: DEMO_CLEANUP_AUTHORIZATION,
    },
    {
      findCompanies: async () => {
        reads += 1;
        return [];
      },
    }
  );
  assert.equal(result.success, true);
  assert.equal(result.dryRun, false);
  assert.equal(reads, 1);
});

type RouteFixture = {
  cleanupResult?: Record<string, unknown>;
  cleanupError?: Error;
};

function loadRoute(fixture: RouteFixture, env: Record<string, string | undefined>) {
  const module = { exports: {} };
  const incidents: Record<string, unknown>[] = [];
  let cleanupCalls = 0;
  const source = ts.transpileModule(
    readFileSync(resolve("src/app/api/cron/demo-cleanup/route.ts"), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }
  ).outputText;
  runInNewContext(source, {
    Error,
    Promise,
    Request,
    process: { env },
    exports: module.exports,
    module,
    require: (id: string) => {
      const dependencies: Record<string, unknown> = {
        "next/server": { NextResponse },
        "@/domains/data-lifecycle/demo-cleanup-batch.service": {
          cleanupExpiredDemoSessions: async () => {
            cleanupCalls += 1;
            if (fixture.cleanupError) throw fixture.cleanupError;
            return fixture.cleanupResult;
          },
        },
        "@/domains/data-lifecycle/demo-cleanup.service": {
          DEMO_CLEANUP_AUTHORIZATION,
        },
        "@/lib/operations/incident-reporter": {
          reportOperationalIncident: async (incident: Record<string, unknown>) => {
            incidents.push(incident);
          },
        },
      };
      assert.ok(id in dependencies, `Unexpected dependency ${id}`);
      return dependencies[id];
    },
  });
  return {
    GET: (module.exports as { GET: (request: Request) => Promise<Response> }).GET,
    incidents,
    cleanupCalls: () => cleanupCalls,
  };
}

function request(secret = "secret") {
  return new Request("http://local/api/cron/demo-cleanup", {
    headers: { authorization: `Bearer ${secret}` },
  });
}

test("la route refuse secret absent ou activation manquante sans lancer le lot", async () => {
  const disabled = loadRoute({}, { CRON_SECRET: "secret" });
  assert.equal((await disabled.GET(request("wrong"))).status, 401);
  assert.equal((await disabled.GET(request())).status, 503);
  assert.equal(disabled.cleanupCalls(), 0);
  assert.equal(disabled.incidents.length, 0);
});

test("la route confirme le succès et alerte sur blocage ou reliquat", async () => {
  const success = loadRoute(
    {
      cleanupResult: {
        success: true,
        processed: 2,
        counts: { deleted: 2, blocked: 0 },
        remaining: false,
      },
    },
    {
      CRON_SECRET: "secret",
      DEMO_CLEANUP_ENABLED: DEMO_CLEANUP_AUTHORIZATION,
    }
  );
  assert.equal((await success.GET(request())).status, 200);
  assert.equal(success.incidents.length, 0);

  const blocked = loadRoute(
    {
      cleanupResult: {
        success: false,
        processed: 1,
        counts: { deleted: 0, blocked: 1 },
        remaining: false,
      },
    },
    {
      CRON_SECRET: "secret",
      DEMO_CLEANUP_ENABLED: DEMO_CLEANUP_AUTHORIZATION,
    }
  );
  const response = await blocked.GET(request());
  assert.equal(response.status, 503);
  assert.equal(blocked.incidents.length, 1);
  assert.equal(blocked.incidents[0]?.fingerprint, "demo-cleanup-blocked");
});

test("une panne est masquée au client et signalée sans identifiant", async () => {
  const route = loadRoute(
    { cleanupError: new Error("provider unavailable for company-secret") },
    {
      CRON_SECRET: "secret",
      DEMO_CLEANUP_ENABLED: DEMO_CLEANUP_AUTHORIZATION,
    }
  );
  const response = await route.GET(request());
  assert.equal(response.status, 500);
  assert.ok(!(await response.text()).includes("company-secret"));
  assert.equal(route.incidents.length, 1);
  assert.equal(route.incidents[0]?.fingerprint, "demo-cleanup-worker-crash");
  assert.ok(!JSON.stringify(route.incidents[0]).includes("company-secret"));
});
