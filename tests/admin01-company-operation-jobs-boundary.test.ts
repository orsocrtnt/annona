import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server";

function load(role: string, calls: string[]) {
  const module = { exports: {} as {
    GET?: () => Promise<Response>;
    POST?: () => Promise<Response>;
  } };
  const source = ts.transpileModule(readFileSync("src/app/api/operations/jobs/route.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const dependencies: Record<string, unknown> = {
    "next/server": { NextResponse },
    "@/lib/api/auth-guard": {
      requireStaffRole: async (permission: string) => {
        calls.push(`staff:${permission}`);
        return { context: { user: { role: { systemRole: role } } } };
      },
      requireRole: (context: { user: { role: { systemRole: string } } }, roles: string[]) => {
        calls.push("role");
        assert.equal([...roles].join(","), "COMPANY_ADMIN,MINI_ADMIN,DISPATCHER");
        return roles.includes(context.user.role.systemRole)
          ? null
          : NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      },
      getCompanyId: () => { calls.push("company"); return "company-1"; },
    },
    "@/lib/api/route-handler": {
      withApiHandler: async (handler: () => Promise<Response>) => handler(),
    },
    "@/domains/operations/operation-job.service": {
      getOperationJobHealth: async () => { calls.push("health"); return { status: "ok" }; },
      retryFailedOperationJobs: async () => { calls.push("retry"); return { retried: 1 }; },
    },
  };
  runInNewContext(source, {
    Error, exports: module.exports, module,
    require: (id: string) => {
      assert.ok(id in dependencies, `Unexpected dependency ${id}`);
      return dependencies[id];
    },
  });
  return module.exports;
}

test("ADMIN-1 jobs entreprise : santé et relance refusées avant l'entreprise", async () => {
  const calls: string[] = [];
  const route = load("SUPER_ADMIN", calls);
  assert.equal((await route.GET!()).status, 403);
  assert.equal((await route.POST!()).status, 403);
  assert.deepEqual(calls, ["staff:deliveries:dispatch", "role", "staff:deliveries:dispatch", "role"]);
});

test("ADMIN-1 jobs entreprise : les trois rôles conservent santé et relance", async () => {
  for (const role of ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER"]) {
    const calls: string[] = [];
    const route = load(role, calls);
    const health = await route.GET!();
    const retry = await route.POST!();
    assert.equal(health.status, 200);
    assert.equal(retry.status, 200);
    assert.deepEqual(await health.json(), { data: { status: "ok" }, success: true });
    assert.deepEqual(await retry.json(), { data: { retried: 1 }, success: true });
  }
});
