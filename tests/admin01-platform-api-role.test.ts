import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server";

const routes = [
  ["src/app/api/admin/access-events/route.ts", "@/domains/admin/platform-access.service", true],
  ["src/app/api/admin/overview/route.ts", "@/domains/admin/platform.service", false],
  ["src/app/api/admin/home/route.ts", "@/domains/admin/admin-home.service", true],
  ["src/app/api/admin/saas-health/route.ts", "@/domains/admin/saas-health.service", false],
  ["src/app/api/admin/service-health/route.ts", "@/domains/admin/service-health.service", false],
  ["src/app/api/admin/companies/route.ts", "@/domains/admin/companies.service", true],
  ["src/app/api/admin/companies/[id]/route.ts", "@/domains/admin/companies.service", false],
  ["src/app/api/admin/users/route.ts", "@/domains/admin/users.service", true],
  ["src/app/api/admin/subscriptions/route.ts", "@/domains/admin/subscriptions.service", true],
  ["src/app/api/admin/support-tickets/route.ts", "@/domains/admin/support-tickets.service", true],
  ["src/app/api/admin/operation-jobs/route.ts", "@/domains/admin/operation-jobs.service", true],
  ["src/app/api/admin/incidents/route.ts", "@/domains/admin/incidents.service", true],
] as const;

function load(file: string, service: string, role: string, calls: string[]) {
  const module = { exports: {} as { GET?: (request?: Request, context?: { params: Promise<{ id: string }> }) => Promise<Response> } };
  const source = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const sink = new Proxy({}, {
    get(_target, prop) {
      if (typeof prop !== "string") return undefined;
      if (prop.startsWith("parse")) return () => { calls.push("parse"); return { query: {} }; };
      return async () => { calls.push("service"); return { ok: true }; };
    },
  });
  runInNewContext(source, {
    Error, URL, exports: module.exports, module,
    require: (id: string) => {
      if (id === "next/server") return { NextResponse };
      if (id === "@/lib/api/auth-guard") return {
        requireStaffRole: async (permission: string) => {
          calls.push(`staff:${permission}`);
          return { context: { user: { role: { systemRole: role } } } };
        },
        requireRole: (context: { user: { role: { systemRole: string } } }, roles: string[]) => {
          calls.push("role");
          assert.equal([...roles].join(","), "SUPER_ADMIN");
          return context.user.role.systemRole === "SUPER_ADMIN"
            ? null
            : NextResponse.json({ error: "Accès refusé" }, { status: 403 });
        },
      };
      if (id === service) return sink;
      if (id === "@/lib/api/platform-access") return { gatePlatformRead: async (_context: unknown, denied: Response | null) => denied };
      throw new Error(`Unexpected dependency ${id}`);
    },
  });
  return module.exports;
}

function watched(calls: string[]) {
  const request = new Request("http://local/api/admin/list");
  return new Proxy(request, {
    get(target, prop, receiver) {
      if (prop === "url") calls.push("url");
      return Reflect.get(target, prop, receiver);
    },
  });
}

test("ADMIN-1 API plateforme : un autre rôle reste refusé malgré dashboard:admin", async () => {
  for (const role of ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER"]) {
    for (const [file, service, usesRequest] of routes) {
      const calls: string[] = [];
      const route = load(file, service, role, calls);
      const response = await route.GET!(usesRequest ? watched(calls) : undefined);
      assert.equal(response.status, 403, file);
      assert.deepEqual(calls, ["staff:dashboard:admin", "role"]);
    }
  }
});

test("ADMIN-1 API plateforme : SUPER_ADMIN conserve la lecture", async () => {
  for (const [file, service, usesRequest] of routes) {
    const calls: string[] = [];
    const response = await load(file, service, "SUPER_ADMIN", calls).GET!(usesRequest ? watched(calls) : undefined, { params: Promise.resolve({ id: "company-1" }) });
    assert.equal(response.status, 200, file);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(calls.includes("service"), true);
  }
  const api = readFileSync("src/features/admin/api.ts", "utf8");
  for (const path of ["/api/admin/overview", "/api/admin/home", "/api/admin/saas-health", "/api/admin/service-health", "/api/admin/companies", "/api/admin/users", "/api/admin/subscriptions", "/api/admin/support-tickets", "/api/admin/operation-jobs", "/api/admin/incidents"]) {
    const line = api.split("\n").find((entry) => entry.includes(path));
    assert.equal(line?.includes('cache: "no-store"'), true, path);
  }
});

test("ADMIN-1 API plateforme : une erreur locale n'est pas mise en cache", async () => {
  const calls: string[] = [];
  const module = { exports: {} as { GET?: (request: Request) => Promise<Response> } };
  const source = ts.transpileModule(readFileSync("src/app/api/admin/companies/route.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  runInNewContext(source, {
    Error, URL, exports: module.exports, module,
    require: (id: string) => {
      if (id === "next/server") return { NextResponse };
      if (id === "@/lib/api/auth-guard") return {
        requireStaffRole: async () => ({ context: { user: { role: { systemRole: "SUPER_ADMIN" } } } }),
        requireRole: () => null,
      };
      if (id === "@/domains/admin/companies.service") return {
        parseCompanyListParams: () => ({ error: "Page invalide" }),
        listPlatformCompanies: async () => { calls.push("service"); return { rows: [] }; },
      };
      if (id === "@/lib/api/platform-access") return { gatePlatformRead: async (_context: unknown, denied: Response | null) => denied };
      throw new Error(id);
    },
  });
  const response = await module.exports.GET!(new Request("http://local/api/admin/companies?page=0"));
  assert.equal(response.status, 400);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal((await response.json()).error, "Page invalide");
  assert.deepEqual(calls, []);
});
