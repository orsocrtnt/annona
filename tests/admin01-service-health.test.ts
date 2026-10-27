import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server";
import { projectServiceHealth, readPlatformServiceHealth } from "../src/domains/admin/service-health.service";

function source(status: "ok" | "degraded" | "down") {
  return {
    status,
    checkedAt: "2026-10-25T12:00:00.000Z",
    checks: {
      database: { status, durationMs: 4, error: "postgres://secret", url: "https://db.internal" },
      storage: { status, durationMs: 8 },
      queue: { status, durationMs: 0, failed: status === "ok" ? 0 : 2, stale: 1 },
    },
    configuration: { cron: true, token: "CRON_SECRET" },
  };
}

function load(file: string, dependencies: Record<string, unknown>) {
  const module = { exports: {} as Record<string, (...args: never[]) => Promise<unknown>> };
  const compiled = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  runInNewContext(compiled, {
    Error, Date, URL, exports: module.exports, module,
    require: (id: string) => {
      assert.ok(id in dependencies, `Unexpected dependency ${id}`);
      return dependencies[id];
    },
  });
  return module.exports;
}

test("ADMIN-1 santé : projection minimale des trois états", async () => {
  for (const status of ["ok", "degraded", "down"] as const) {
    const projected = projectServiceHealth(source(status));
    assert.equal(projected.status, status);
    assert.equal(projected.database.status, status);
    assert.equal(projected.storage.durationMs, 8);
    assert.equal(projected.queue.failed, status === "ok" ? 0 : 2);
    const encoded = JSON.stringify(projected);
    for (const forbidden of ["configuration", "CRON_SECRET", "postgres://", "https://", "error"]) {
      assert.equal(encoded.includes(forbidden), false);
    }
    assert.deepEqual(Object.keys(projected).sort(), ["checkedAt", "database", "queue", "status", "storage"]);
  }
  let called = false;
  const read = await readPlatformServiceHealth(async () => {
    called = true;
    return source("ok");
  });
  assert.equal(called, true);
  assert.equal(read.status, "ok");
});

test("ADMIN-1 santé : accès refusé avant contrôle et erreur générique", async () => {
  let allowed = false;
  const reads: string[] = [];
  const route = load("src/app/api/admin/service-health/route.ts", {
    "next/server": { NextResponse },
    "@/lib/api/auth-guard": {
      requireStaffRole: async (permission: string) => {
        assert.equal(permission, "dashboard:admin");
        return allowed ? { context: {} } : { error: NextResponse.json({ error: "Accès refusé" }, { status: 403 }) };
      },
      requireRole: () => null,
    },
    "@/lib/api/platform-access": { gatePlatformRead: async (_context: unknown, denied: Response | null) => denied },
    "@/domains/admin/service-health.service": {
      readPlatformServiceHealth: async () => {
        reads.push("read");
        if (reads.length > 1) throw new Error("postgres://secret");
        return projectServiceHealth(source("degraded"));
      },
    },
  });
  const get = route.GET as unknown as () => Promise<Response>;
  assert.equal((await get()).status, 403);
  assert.equal(reads.length, 0);
  allowed = true;
  const ok = await get();
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("cache-control"), "no-store");
  const body = await ok.json() as { data: { status: string } };
  assert.equal(body.data.status, "degraded");
  assert.equal(JSON.stringify(body).includes("configuration"), false);
  const failed = await get();
  assert.equal(failed.status, 500);
  assert.equal((await failed.json()).error, "Santé des services indisponible.");
  const screen = readFileSync("src/app/(back-office)/admin/operations/page.tsx", "utf8");
  assert.equal(screen.includes("useAdminServiceHealth"), true);
  assert.equal(screen.includes("useAdminOperationJobs"), true);
  assert.equal(screen.includes("configuration"), false);
});
