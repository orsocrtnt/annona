import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server";
import {
  listOperationJobs,
  operationJobSelect,
  parseOperationJobListParams,
  toOperationJobRow,
  type OperationJobListParams,
} from "../src/domains/admin/operation-jobs.service";

const now = new Date("2026-10-25T12:00:00.000Z");

function row(status: "PENDING" | "PROCESSING" | "SUCCEEDED" | "FAILED", lockedAt: Date | null) {
  return {
    id: "job-1",
    type: "DRIVER_NOTIFICATION" as const,
    status,
    attempts: 1,
    maxAttempts: 3,
    nextAttemptAt: now,
    lockedAt,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    company: null,
  };
}

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

test("ADMIN-1 jobs : filtres, tri, select minimal et bornes de blocage", async () => {
  assert.equal((parseOperationJobListParams(new URLSearchParams(`page=${"9".repeat(400)}`)) as { error: string }).error, "Page invalide");
  assert.equal((parseOperationJobListParams(new URLSearchParams("page=90071992547411&pageSize=100")) as { error: string }).error, "Page invalide");
  const parsed = parseOperationJobListParams(new URLSearchParams("q=Acme&status=FAILED&type=CLIENT_NOTIFICATION&page=2&pageSize=25"));
  assert.ok("query" in parsed);
  const calls: string[] = [];
  await listOperationJobs({ ...parsed.query, now } as OperationJobListParams, {
    operationJob: {
      count: async () => { calls.push("count"); return 0; },
      findMany: async (args) => {
        calls.push("findMany");
        assert.deepEqual(args.orderBy, [{ updatedAt: "desc" }, { id: "desc" }]);
        assert.equal(args.skip, 25);
        assert.equal((args.where as { status: string }).status, "FAILED");
        assert.equal((args.where as { company: { name: { contains: string } } }).company.name.contains, "Acme");
        return [];
      },
    },
  });
  assert.deepEqual(calls, ["count", "findMany"]);
  const select = operationJobSelect();
  for (const forbidden of ["payload", "jobKey", "lastError"]) assert.equal(forbidden in select, false);

  const almost = new Date(now.getTime() - (10 * 60_000 - 1));
  const exact = new Date(now.getTime() - 10 * 60_000);
  assert.equal(toOperationJobRow(row("PROCESSING", almost), now).stale, false);
  assert.equal(toOperationJobRow(row("PROCESSING", exact), now).stale, true);
  assert.equal(toOperationJobRow(row("FAILED", exact), now).stale, false);
  assert.equal(toOperationJobRow(row("PROCESSING", null), now).company, null);
});

test("ADMIN-1 jobs : accès refusé avant lecture et aucune écriture", async () => {
  let allowed = false;
  const reads: string[] = [];
  const route = load("src/app/api/admin/operation-jobs/route.ts", {
    "next/server": { NextResponse },
    "@/lib/api/auth-guard": {
      requireStaffRole: async (permission: string) => {
        assert.equal(permission, "dashboard:admin");
        return allowed ? { context: {} } : { error: NextResponse.json({ error: "Accès refusé" }, { status: 403 }) };
      },
      requireRole: () => null,
    },
    "@/lib/api/platform-access": { gatePlatformRead: async (_context: unknown, denied: Response | null) => denied },
    "@/domains/admin/operation-jobs.service": {
      parseOperationJobListParams,
      listOperationJobs: async () => { reads.push("read"); return { page: 1, pageSize: 25, total: 0, rows: [] }; },
    },
  });
  const get = route.GET as unknown as (request: Request) => Promise<Response>;
  assert.equal((await get(new Request("http://localhost/api/admin/operation-jobs"))).status, 403);
  assert.equal(reads.length, 0);
  allowed = true;
  const ok = await get(new Request("http://localhost/api/admin/operation-jobs"));
  assert.equal(ok.headers.get("cache-control"), "no-store");
  assert.deepEqual(reads, ["read"]);
});

test("DEMO-3 jobs : la facture à la livraison est un type filtrable dans l'exploitation", () => {
  assert.ok("query" in parseOperationJobListParams(new URLSearchParams("type=DELIVERY_INVOICE")));
  const page = readFileSync("src/app/(back-office)/admin/operations/page.tsx", "utf8");
  assert.match(page, /value: "DELIVERY_INVOICE", label: "Facture à la livraison"/);
});
