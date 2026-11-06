import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server";
import {
  listPlatformCompanies,
  parseCompanyListParams,
  platformCompanySelect,
  type CompanyListParams,
} from "../src/domains/admin/companies.service";

const now = new Date("2026-10-25T12:00:00.000Z");

function load(file: string, dependencies: Record<string, unknown>) {
  const module = { exports: {} as Record<string, (...args: never[]) => Promise<unknown>> };
  const source = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  runInNewContext(source, {
    Error, Date, URL, exports: module.exports, module,
    require: (id: string) => {
      assert.ok(id in dependencies, `Unexpected dependency ${id}`);
      return dependencies[id];
    },
  });
  return module.exports;
}

test("ADMIN-1 entreprises : filtres, pagination, select minimal et compteurs", async () => {
  assert.equal((parseCompanyListParams(new URLSearchParams(`page=${"9".repeat(400)}`)) as { error: string }).error, "Page invalide");
  assert.equal((parseCompanyListParams(new URLSearchParams("page=90071992547411&pageSize=100")) as { error: string }).error, "Page invalide");
  assert.equal((parseCompanyListParams(new URLSearchParams("status=DEMO")) as { error: string }).error, "Statut invalide");
  const parsed = parseCompanyListParams(new URLSearchParams("q=Acme&status=TRIAL&page=2&pageSize=50"));
  assert.ok("query" in parsed);
  const calls: string[] = [];
  const page = await listPlatformCompanies(parsed.query as CompanyListParams, {
    company: {
      count: async () => { calls.push("count"); return 1; },
      findMany: async (args) => {
        calls.push("findMany");
        assert.deepEqual(args.orderBy, [{ updatedAt: "desc" }, { id: "desc" }]);
        assert.equal(args.skip, 50);
        const where = args.where as { status: string; name: { contains: string } };
        assert.equal(where.status, "TRIAL");
        assert.equal(where.name.contains, "Acme");
        return [{
          id: "company-1",
          name: "Acme",
          status: "TRIAL" as const,
          createdAt: now,
          _count: { users: 4, orders: 9 },
        }];
      },
    },
  });
  assert.deepEqual(calls, ["count", "findMany"]);
  assert.equal(page.rows[0]?.userCount, 4);
  assert.equal(page.rows[0]?.deliveryCount, 9);
  const select = platformCompanySelect();
  for (const forbidden of ["email", "phone", "address", "settings", "legalName", "siren", "siret", "slug"]) {
    assert.equal(forbidden in select, false);
  }
  assert.equal(JSON.stringify(page).includes("saasSubscription"), false);
  const screen = readFileSync("src/app/(back-office)/companies/page.tsx", "utf8");
  const overview = readFileSync("src/app/(back-office)/admin/page.tsx", "utf8");
  assert.equal(screen.includes("useAdminOverview"), false);
  assert.equal(screen.includes("useAdminCompanies"), true);
  assert.equal(overview.includes("useAdminOverview"), true);
});

test("ADMIN-1 entreprises : accès refusé avant lecture et aucune écriture", async () => {
  let allowed = false;
  const reads: string[] = [];
  const route = load("src/app/api/admin/companies/route.ts", {
    "next/server": { NextResponse },
    "@/lib/api/auth-guard": {
      requireStaffRole: async (permission: string) => {
        assert.equal(permission, "dashboard:admin");
        return allowed ? { context: {} } : { error: NextResponse.json({ error: "Accès refusé" }, { status: 403 }) };
      },
      requireRole: () => null,
    },
    "@/lib/api/platform-access": { gatePlatformRead: async (_context: unknown, denied: Response | null) => denied },
    "@/domains/admin/companies.service": {
      parseCompanyListParams,
      listPlatformCompanies: async () => { reads.push("read"); return { page: 1, pageSize: 25, total: 0, rows: [] }; },
    },
  });
  const get = route.GET as unknown as (request: Request) => Promise<Response>;
  assert.equal((await get(new Request("http://localhost/api/admin/companies"))).status, 403);
  assert.equal(reads.length, 0);
  allowed = true;
  assert.equal((await get(new Request("http://localhost/api/admin/companies?email=a@b.c"))).status, 400);
  assert.equal(reads.length, 0);
  const ok = await get(new Request("http://localhost/api/admin/companies"));
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("cache-control"), "no-store");
  assert.deepEqual(reads, ["read"]);
});
