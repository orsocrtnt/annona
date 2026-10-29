import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server";
import { canSeeDispatchRules } from "../src/features/back-office/dispatch-access";

function load(role: string, calls: string[]) {
  const module = { exports: {} as Record<string, (request?: Request) => Promise<Response>> };
  const source = ts.transpileModule(readFileSync("src/app/api/company/dispatch/route.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const dependencies: Record<string, unknown> = {
    "next/server": { NextResponse },
    "@/lib/config-messages": require("../src/lib/config-messages"),
    "@/lib/api/auth-guard": {
      requireStaffRole: async () => {
        calls.push("staff");
        return { context: { user: { role: { systemRole: role } } } };
      },
      requireRole: (context: { user: { role: { systemRole: string } } }, roles: string[]) => {
        calls.push("role");
        assert.equal([...roles].join(","), "COMPANY_ADMIN,MINI_ADMIN");
        return roles.includes(context.user.role.systemRole)
          ? null
          : NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      },
      getCompanyId: () => { calls.push("company"); return "company-1"; },
    },
    "@/domains/company/dispatch-settings.service": {
      getCompanyDispatchSettings: async () => { calls.push("read"); return {}; },
      updateCompanyDispatchSettings: async () => { calls.push("write"); return {}; },
    },
    "@/lib/validations/dispatch-settings": {
      companyDispatchSettingsSchema: { safeParse: () => { calls.push("parse"); return { success: true, data: {} }; } },
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

test("ADMIN-1 règles dispatch : visibilité et refus anticipés", async () => {
  const both = ["settings:read", "settings:update"];
  assert.equal(canSeeDispatchRules("COMPANY_ADMIN", both), true);
  assert.equal(canSeeDispatchRules("MINI_ADMIN", both), true);
  assert.equal(canSeeDispatchRules("COMPANY_ADMIN", ["settings:read"]), false);
  assert.equal(canSeeDispatchRules("MINI_ADMIN", ["settings:update"]), false);
  assert.equal(canSeeDispatchRules("DISPATCHER", both), false);
  assert.equal(canSeeDispatchRules("SUPER_ADMIN", both), false);

  for (const role of ["SUPER_ADMIN", "DISPATCHER"]) {
    const calls: string[] = [];
    const route = load(role, calls);
    const request = new Request("http://local/api/company/dispatch", { method: "PATCH", body: "{}" });
    const read = request.json.bind(request);
    Object.defineProperty(request, "json", { value: async () => { calls.push("body"); return read(); } });
    assert.equal((await route.GET!()).status, 403);
    assert.equal((await route.PATCH!(request)).status, 403);
    assert.deepEqual(calls, ["staff", "role", "staff", "role"]);
  }

  for (const role of ["COMPANY_ADMIN", "MINI_ADMIN"]) {
    const calls: string[] = [];
    const route = load(role, calls);
    assert.equal((await route.GET!()).status, 200);
    assert.equal((await route.PATCH!(new Request("http://local/api/company/dispatch", { method: "PATCH", body: "{}" }))).status, 200);
    assert.deepEqual(calls, ["staff", "role", "company", "read", "staff", "role", "company", "parse", "write"]);
  }

  const screen = readFileSync("src/app/(back-office)/dispatch/page.tsx", "utf8");
  assert.equal(screen.includes("canSeeDispatchRules"), true);
  assert.equal(screen.includes("activeView === \"rules\" ? ("), true);
  assert.equal(screen.includes("File d&apos;attente"), true);
  assert.equal(screen.includes("useRunAutoDispatch"), true);
});
