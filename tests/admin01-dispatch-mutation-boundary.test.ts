import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server";
import { withApiHandler } from "../src/lib/api/route-handler";

function load(role: string, calls: string[], saas: () => Promise<void>) {
  const module = { exports: {} as { POST?: () => Promise<Response> } };
  const source = ts.transpileModule(readFileSync("src/app/api/dispatch/auto-assign/route.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const dependencies: Record<string, unknown> = {
    "next/server": { NextResponse },
    "@/lib/api/route-handler": { withApiHandler },
    "@/lib/api/auth-guard": {
      requireStaffRole: async (permission: string) => {
        calls.push("staff");
        assert.equal(permission, "deliveries:dispatch");
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
    "@/domains/saas/saas.service": { assertSaasMutationFeature: async () => { calls.push("saas"); return saas(); } },
    "@/domains/delivery/auto-dispatch.service": { runAutoDispatchQueue: async () => { calls.push("queue"); return { assigned: 0 }; } },
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

test("ADMIN-1 affectation : super-admin refusé avant entreprise, droit et traitement", async () => {
  const calls: string[] = [];
  const route = load("SUPER_ADMIN", calls, async () => undefined);
  const response = await route.POST!();
  assert.equal(response.status, 403);
  assert.deepEqual(calls, ["staff", "role"]);
});

test("ADMIN-1 affectation : ordre conservé et refus SaaS inchangés", async () => {
  for (const role of ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER"]) {
    const calls: string[] = [];
    const ok = await load(role, calls, async () => undefined).POST!();
    assert.equal(ok.status, 200);
    assert.deepEqual(calls, ["staff", "role", "company", "saas", "queue"]);
  }
  for (const [code, message] of [
    ["SAAS_FEATURE_NOT_AVAILABLE", "Le dispatch automatique n’est pas inclus dans cette offre."],
    ["SAAS_ACCOUNT_READ_ONLY", "Le compte est en lecture seule."],
  ] as const) {
    const calls: string[] = [];
    const response = await load("COMPANY_ADMIN", calls, async () => { throw new Error(code); }).POST!();
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error, message);
    assert.equal(calls.includes("queue"), false);
  }
});
