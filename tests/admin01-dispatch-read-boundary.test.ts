import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server";
import { withApiHandler } from "../src/lib/api/route-handler";

const routes = [
  "src/app/api/dispatch/overview/route.ts",
  "src/app/api/dispatch/drivers-workload/route.ts",
  "src/app/api/dispatch/drivers-locations/route.ts",
  "src/app/api/dispatch/drivers-map/route.ts",
  "src/app/api/dispatch/map/route.ts",
  "src/app/api/dispatch/eligible-drivers/route.ts",
];

function load(file: string, dependencies: Record<string, unknown>) {
  const module = { exports: {} as { GET?: (request?: Request) => Promise<Response> } };
  const source = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  runInNewContext(source, {
    Error, URL, console, exports: module.exports, module,
    require: (id: string) => {
      assert.ok(id in dependencies, `Unexpected dependency ${id}`);
      return dependencies[id];
    },
  });
  return module.exports;
}

function sink(calls: string[]) {
  return new Proxy({}, {
    get: () => () => {
      calls.push("down");
      return Promise.resolve({ ok: true });
    },
  });
}

function guard(role: string, calls: string[]) {
  return {
    requireStaffRole: async () => {
      calls.push("staff");
      return { context: { user: { id: "user-1", company: { settings: {} }, role: { systemRole: role } } } };
    },
    requireRole: (context: { user: { role: { systemRole: string } } }, roles: string[]) => {
      calls.push("role");
      assert.equal([...roles].join(","), "COMPANY_ADMIN,MINI_ADMIN,DISPATCHER");
      return roles.includes(context.user.role.systemRole)
        ? null
        : NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    },
    getCompanyId: () => { calls.push("company"); return "company-1"; },
  };
}

function deps(file: string, role: string, calls: string[]) {
  const base: Record<string, unknown> = {
    "next/server": { NextResponse },
    "@/lib/api/route-handler": { withApiHandler },
    "@/lib/api/auth-guard": guard(role, calls),
  };
  for (const id of [
    "@/domains/delivery/delivery.service",
    "@/domains/order/order.service",
    "@/domains/company/dispatch-settings.service",
    "@/domains/company/location-settings.service",
    "@/domains/driver/driver-location.service",
    "@/domains/saas/saas.service",
    "@/domains/delivery/dispatch-map.service",
    "@/domains/delivery/auto-dispatch.service",
  ]) base[id] = sink(calls);
  void file;
  return base;
}

test("ADMIN-1 dispatch : super-admin refusé avant entreprise, paramètres et métier", async () => {
  const calls: string[] = [];
  for (const file of routes) {
    const route = load(file, deps(file, "SUPER_ADMIN", calls));
    const response = await route.GET!(new Request("http://local/api?deliveryId=d1"));
    assert.equal(response.status, 403, file);
  }
  assert.equal(calls.includes("company"), false);
  assert.equal(calls.includes("down"), false);
  assert.equal(calls.filter((call) => call === "staff").length, 6);
  assert.equal(calls.filter((call) => call === "role").length, 6);
});

test("ADMIN-1 dispatch : les trois rôles autorisés passent la lecture", async () => {
  const samples = [
    ["COMPANY_ADMIN", "src/app/api/dispatch/drivers-workload/route.ts"],
    ["MINI_ADMIN", "src/app/api/dispatch/drivers-map/route.ts"],
    ["DISPATCHER", "src/app/api/dispatch/eligible-drivers/route.ts"],
  ] as const;
  for (const [role, file] of samples) {
    const calls: string[] = [];
    const route = load(file, deps(file, role, calls));
    const response = await route.GET!(new Request("http://local/api?deliveryId=d1"));
    assert.equal(response.status, 200, role);
    assert.equal(calls.includes("company"), true);
    assert.equal(calls.includes("down"), true);
  }
});
