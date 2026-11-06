import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server";
import { withApiHandler } from "../src/lib/api/route-handler";
import { adminNavItems, bakerNavItems, companyNavItems } from "../src/features/navigation/nav-config";
import { getPageAccessRule } from "../src/lib/permissions/page-access";
import { getAllowedRolesForPath } from "../src/lib/permissions/rbac";

function load(file: string, dependencies: Record<string, unknown>) {
  const module = { exports: {} as Record<string, (request?: Request) => Promise<Response>> };
  const source = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  runInNewContext(source, {
    Error, exports: module.exports, module,
    require: (id: string) => {
      assert.ok(id in dependencies, `Unexpected dependency ${id}`);
      return dependencies[id];
    },
  });
  return module.exports;
}

function titles(items: Array<{ title: string }>) {
  return items.map((item) => item.title);
}

test("ADMIN-1 paramètres : navigation et règles réservent /settings aux rôles entreprise", () => {
  assert.equal(titles(adminNavItems).includes("Facturation"), false);
  assert.equal(titles(adminNavItems).includes("Paramètres"), false);
  assert.equal(titles(companyNavItems).includes("Facturation"), true);
  assert.equal(titles(companyNavItems).includes("Paramètres"), true);
  assert.equal(titles(bakerNavItems).includes("Facturation"), false);
  assert.equal(titles(bakerNavItems).includes("Paramètres"), false);

  for (const path of ["/settings", "/settings/billing"]) {
    const roles = getAllowedRolesForPath(path);
    assert.equal(roles.includes("SUPER_ADMIN"), false);
    assert.equal(roles.includes("ADMIN"), true);
    assert.equal(roles.includes("BAKER"), false);
  }
  const guard = getPageAccessRule("/settings");
  assert.equal(guard?.path, "/settings");
  assert.equal(guard?.roles.includes("SUPER_ADMIN"), false);
  assert.equal(guard?.roles.includes("ADMIN"), true);
  assert.equal(guard?.roles.includes("BAKER"), false);
});

test("ADMIN-1 paramètres : super-admin refusé avant entreprise, corps et métier", async () => {
  const calls: string[] = [];
  function auth(role: string) {
    return {
      requireStaffRole: async () => ({ context: { user: { companyId: "c1", role: { systemRole: role } } } }),
      requireRole: (context: { user: { role: { systemRole: string } } }, roles: string[]) => {
        assert.equal([...roles].join(","), "ADMIN");
        return ["ADMIN"].includes(context.user.role.systemRole)
          ? null
          : NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      },
      getCompanyId: () => { calls.push("company"); return "c1"; },
    };
  }
  const billingService = {
    getCompanyBillingSettings: async () => { calls.push("read"); return {}; },
    updateCompanyBillingSettings: async () => { calls.push("write"); return {}; },
  };
  const validation = {
    companyBillingSettingsSchema: { safeParse: () => { calls.push("parse"); return { success: true, data: {} }; } },
  };
  const billing = load("src/app/api/company/billing-settings/route.ts", {
    "next/server": { NextResponse },
    "@/lib/api/route-handler": { withApiHandler },
    "@/lib/api/auth-guard": auth("SUPER_ADMIN"),
    "@/domains/company/billing-settings.service": billingService,
    "@/domains/invoice/facturx/facturx.service": { getCompanyEinvoicing: async () => null },
    "@/domains/invoice/facturx/facturx-readiness": { checkSellerReadiness: () => [] },
    "@/lib/validations/einvoicing": { readinessFieldErrors: () => ({}) },
    "@/lib/config-messages": { zodIssueMessage: () => "invalide" },
    "@/lib/validations/billing-settings": validation,
  });
  function tracked(method: string) {
    const request = new Request("http://local/api/company/billing-settings", { method, body: "{}" });
    const read = request.json.bind(request);
    Object.defineProperty(request, "json", { value: async () => { calls.push("body"); return read(); } });
    return request;
  }
  for (const response of [
    await billing.GET!(),
    await billing.PATCH!(tracked("PATCH")),
  ]) {
    assert.equal(response.status, 403);
  }
  assert.deepEqual(calls, []);

  const bakerBilling = load("src/app/api/company/billing-settings/route.ts", {
    "next/server": { NextResponse },
    "@/lib/api/route-handler": { withApiHandler },
    "@/lib/api/auth-guard": auth("BAKER"),
    "@/domains/company/billing-settings.service": billingService,
    "@/domains/invoice/facturx/facturx.service": { getCompanyEinvoicing: async () => null },
    "@/domains/invoice/facturx/facturx-readiness": { checkSellerReadiness: () => [] },
    "@/lib/validations/einvoicing": { readinessFieldErrors: () => ({}) },
    "@/lib/config-messages": { zodIssueMessage: () => "invalide" },
    "@/lib/validations/billing-settings": validation,
  });
  for (const response of [
    await bakerBilling.GET!(),
    await bakerBilling.PATCH!(tracked("PATCH")),
  ]) {
    assert.equal(response.status, 403);
  }
  assert.deepEqual(calls, []);

  const adminBilling = load("src/app/api/company/billing-settings/route.ts", {
    "next/server": { NextResponse },
    "@/lib/api/route-handler": { withApiHandler },
    "@/lib/api/auth-guard": auth("ADMIN"),
    "@/domains/company/billing-settings.service": billingService,
    "@/domains/invoice/facturx/facturx.service": { getCompanyEinvoicing: async () => null },
    "@/domains/invoice/facturx/facturx-readiness": { checkSellerReadiness: () => [] },
    "@/lib/validations/einvoicing": { readinessFieldErrors: () => ({}) },
    "@/lib/config-messages": { zodIssueMessage: () => "invalide" },
    "@/lib/validations/billing-settings": validation,
  });
  assert.equal((await adminBilling.GET!()).status, 200);
  assert.deepEqual(calls, ["company", "read"]);
});
