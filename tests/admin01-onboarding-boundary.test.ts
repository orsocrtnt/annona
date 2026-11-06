import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { z } from "zod";
import { NextResponse } from "next/server";
import { onboardingCompanyProfileSchema, onboardingPreferenceSchema } from "../src/domains/onboarding/onboarding.service";

function load(role: string, calls: string[]) {
  const module = { exports: {} as {
    GET?: () => Promise<Response>;
    PATCH?: (request: Request) => Promise<Response>;
  } };
  const source = ts.transpileModule(readFileSync("src/app/api/onboarding/route.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const dependencies: Record<string, unknown> = {
    zod: { z },
    "next/server": { NextResponse },
    "@/lib/api/auth-guard": {
      requireStaffRole: async (permission: string) => {
        calls.push(`staff:${permission}`);
        return { context: { user: { role: { systemRole: role } } } };
      },
      requireRole: (context: { user: { role: { systemRole: string } } }, roles: string[]) => {
        calls.push("role");
        assert.equal([...roles].join(","), "COMPANY_ADMIN");
        return roles.includes(context.user.role.systemRole)
          ? null
          : NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      },
      getCompanyId: () => { calls.push("company"); return "company-1"; },
    },
    "@/domains/onboarding/onboarding.service": {
      onboardingPreferenceSchema,
      onboardingCompanyProfileSchema,
      getCompanyOnboardingStatus: async () => { calls.push("status"); return { companyName: "Nord" }; },
      updateOnboardingPreference: async () => { calls.push("preference"); },
      updateOnboardingCompanyProfile: async () => { calls.push("profile"); },
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

function bodyRequest(calls: string[]) {
  const request = new Request("http://local/api/onboarding", { method: "PATCH", body: JSON.stringify({ step: "collaborators", skipped: true }) });
  const read = request.json.bind(request);
  Object.defineProperty(request, "json", { value: async () => { calls.push("body"); return read(); } });
  return request;
}

test("ADMIN-1 onboarding : les autres rôles sont refusés avant l'entreprise et le corps", async () => {
  assert.equal(existsSync("src/app/api/company/onboarding"), false);
  const source = readFileSync("src/app/api/onboarding/route.ts", "utf8");
  assert.equal(source.includes('requireRole(auth.context, ["COMPANY_ADMIN"])'), true);
  for (const role of ["SUPER_ADMIN", "MINI_ADMIN", "DISPATCHER"]) {
    const calls: string[] = [];
    const route = load(role, calls);
    assert.equal((await route.GET!()).status, 403);
    assert.equal((await route.PATCH!(bodyRequest(calls))).status, 403);
    assert.deepEqual(calls, ["staff:settings:read", "role", "staff:settings:update", "role"]);
  }
});

test("ADMIN-1 onboarding : l'administrateur d'entreprise conserve les réponses", async () => {
  const calls: string[] = [];
  const route = load("COMPANY_ADMIN", calls);
  const read = await route.GET!();
  assert.equal(read.status, 200);
  assert.deepEqual(await read.json(), { data: { companyName: "Nord" }, success: true });
  const update = await route.PATCH!(bodyRequest(calls));
  assert.equal(update.status, 200);
  assert.equal(calls.includes("preference"), true);
  assert.equal(calls.includes("status"), true);
});
