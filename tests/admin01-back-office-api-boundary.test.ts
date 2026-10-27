import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server";
import { withApiHandler } from "../src/lib/api/route-handler";

function load(file: string, dependencies: Record<string, unknown>) {
  const module = { exports: {} as Record<string, (request?: Request) => Promise<Response>> };
  const source = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  runInNewContext(source, {
    Error, URL, exports: module.exports, module,
    require: (id: string) => {
      assert.ok(id in dependencies, `Unexpected dependency ${id}`);
      return dependencies[id];
    },
  });
  return module.exports;
}

function auth(role: string, calls: string[]) {
  return {
    requireStaffRole: async () => {
      calls.push("staff");
      return { context: { user: { id: "user-1", role: { systemRole: role } } } };
    },
    requireRole: (context: { user: { role: { systemRole: string } } }, roles: string[]) => {
      calls.push("role");
      assert.equal(roles.join(","), "COMPANY_ADMIN,MINI_ADMIN");
      return roles.includes(context.user.role.systemRole)
        ? null
        : NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    },
    getCompanyId: () => { calls.push("company"); return "company-1"; },
  };
}

test("ADMIN-1 tableau de bord : super-admin refusé avant toute lecture aval", async () => {
  const calls: string[] = [];
  const guard = auth("SUPER_ADMIN", calls);
  const dashboard = load("src/app/api/back-office/dashboard/route.ts", {
    "next/server": { NextResponse },
    "@/lib/api/route-handler": { withApiHandler },
    "@/lib/api/auth-guard": guard,
    "@/domains/dashboard/dashboard.service": { getCompanyDashboardStats: async () => { calls.push("service"); return {}; } },
  });
  const analytics = load("src/app/api/back-office/analytics/route.ts", {
    "next/server": { NextResponse },
    "@/lib/api/route-handler": { withApiHandler },
    "@/lib/api/auth-guard": guard,
    "@/domains/analytics/analytics.service": { getCompanyAnalytics: async () => { calls.push("service"); return {}; } },
    "@/domains/saas/saas.service": { assertSaasFeature: async () => { calls.push("saas"); } },
  });
  const layout = load("src/app/api/back-office/dashboard-layout/route.ts", {
    "next/server": { NextResponse },
    "@/lib/api/route-handler": { withApiHandler },
    "@/lib/api/auth-guard": guard,
    "@/domains/back-office/dashboard-settings.service": {
      getDashboardLayout: async () => { calls.push("service"); return {}; },
      updateDashboardLayout: async () => { calls.push("service"); return {}; },
      resetDashboardLayout: async () => { calls.push("service"); return {}; },
    },
    "@/lib/validations/dashboard-layout": { dashboardLayoutSchema: { safeParse: () => { calls.push("parse"); return { success: true, data: {} }; } } },
  });
  const request = new Request("http://local/api/back-office/dashboard-layout", { method: "PATCH", body: "{}" });
  const read = request.json.bind(request);
  Object.defineProperty(request, "json", { value: async () => { calls.push("body"); return read(); } });
  for (const response of [
    await dashboard.GET!(),
    await analytics.GET!(new Request("http://local/api/back-office/analytics")),
    await layout.GET!(),
    await layout.PATCH!(request),
    await layout.DELETE!(),
  ]) {
    assert.equal(response.status, 403);
  }
  assert.deepEqual(calls, ["staff", "role", "staff", "role", "staff", "role", "staff", "role", "staff", "role"]);
});

test("ADMIN-1 tableau de bord : administrateur et mini-admin passent le rôle", async () => {
  const calls: string[] = [];
  const dashboard = load("src/app/api/back-office/dashboard/route.ts", {
    "next/server": { NextResponse },
    "@/lib/api/route-handler": { withApiHandler },
    "@/lib/api/auth-guard": auth("COMPANY_ADMIN", calls),
    "@/domains/dashboard/dashboard.service": { getCompanyDashboardStats: async () => { calls.push("service"); return {}; } },
  });
  const layout = load("src/app/api/back-office/dashboard-layout/route.ts", {
    "next/server": { NextResponse },
    "@/lib/api/route-handler": { withApiHandler },
    "@/lib/api/auth-guard": auth("MINI_ADMIN", calls),
    "@/domains/back-office/dashboard-settings.service": {
      getDashboardLayout: async () => { calls.push("layout"); return {}; },
      updateDashboardLayout: async () => { calls.push("write"); return {}; },
      resetDashboardLayout: async () => { calls.push("reset"); return {}; },
    },
    "@/lib/validations/dashboard-layout": { dashboardLayoutSchema: { safeParse: () => ({ success: true, data: {} }) } },
  });
  assert.equal((await dashboard.GET!()).status, 200);
  assert.equal((await layout.GET!()).status, 200);
  assert.deepEqual(calls, ["staff", "role", "company", "service", "staff", "role", "layout"]);
});
