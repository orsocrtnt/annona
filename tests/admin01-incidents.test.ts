import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server";
import { alertActionKey } from "../src/domains/operational-alerts/operational-alerts.policy";
import {
  deriveIncidentState,
  listPlatformIncidents,
  parseIncidentListParams,
  platformIncidentActionSelect,
  platformIncidentSelect,
  type IncidentListParams,
} from "../src/domains/admin/incidents.service";

const now = new Date("2026-10-25T12:00:00.000Z");

function incident(id: string, status = "ASSIGNED") {
  return {
    id,
    internal: false,
    createdAt: now,
    order: {
      reference: "CMD-1001",
      status,
      company: { name: "Acme" },
      deliveries: [{ completedAt: null, status: "ASSIGNED" }],
    },
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

test("ADMIN-1 incidents : filtres, tri, états et select minimal", async () => {
  assert.equal((parseIncidentListParams(new URLSearchParams(`page=${"9".repeat(400)}`)) as { error: string }).error, "Page invalide");
  assert.equal((parseIncidentListParams(new URLSearchParams("page=90071992547411&pageSize=100")) as { error: string }).error, "Page invalide");
  const parsed = parseIncidentListParams(new URLSearchParams("q=Acme&visibility=SHARED&page=2&pageSize=25"));
  assert.ok("query" in parsed);

  const calls: string[] = [];
  const resolve = alertActionKey("incident:inc-1", "resolve");
  const page = await listPlatformIncidents({ ...parsed.query, now } as IncidentListParams, {
    orderMessage: {
      count: async () => { calls.push("count"); return 1; },
      findMany: async (args) => {
        calls.push("findMany");
        if ("orderBy" in args) {
          assert.deepEqual(args.orderBy, [{ createdAt: "desc" }, { id: "desc" }]);
          assert.equal(args.skip, 25);
          const where = args.where as { kind: string; internal: boolean; order: { company: { name: { contains: string } } } };
          assert.equal(where.kind, "INCIDENT");
          assert.equal(where.internal, false);
          assert.equal(where.order.company.name.contains, "Acme");
          return [incident("inc-1", "CANCELLED")];
        }
        const where = args.where as { requestKey: { in: string[] } };
        assert.ok(where.requestKey.in.includes(resolve));
        assert.deepEqual(Object.keys(args.select as object).sort(), ["orderId", "requestKey"]);
        return [{ orderId: "order-1", requestKey: resolve }];
      },
    },
  });
  assert.deepEqual(calls, ["count", "findMany", "findMany"]);
  assert.equal(page.rows[0]?.state, "RESOLVED");
  assert.equal("requestKey" in page.rows[0]!, false);

  const select = platformIncidentSelect();
  for (const forbidden of ["body", "requestKey", "authorId", "authorName", "authorRole"]) {
    assert.equal(forbidden in select, false);
  }
  assert.deepEqual(platformIncidentActionSelect(), { orderId: true, requestKey: true });

  const open = { status: "ASSIGNED", deliveries: [{ completedAt: null, status: "ASSIGNED" }] };
  const closed = { status: "CANCELLED", deliveries: [] as Array<{ completedAt: Date | null; status: string }> };
  const ack = new Set([alertActionKey("incident:i", "ack")]);
  const both = new Set([...ack, alertActionKey("incident:i", "resolve")]);
  assert.equal(deriveIncidentState("i", open, new Set()), "OPEN");
  assert.equal(deriveIncidentState("i", open, ack), "ACKNOWLEDGED");
  assert.equal(deriveIncidentState("i", closed, ack), "CLOSED");
  assert.equal(deriveIncidentState("i", closed, both), "RESOLVED");

  const screen = readFileSync("src/app/(back-office)/admin/incidents/page.tsx", "utf8");
  for (const forbidden of ["body", "requestKey", "authorId", "authorName", "authorRole"]) {
    assert.equal(screen.includes(forbidden), false);
  }
});

test("ADMIN-1 incidents : accès refusé avant lecture et aucune écriture", async () => {
  let allowed = false;
  const reads: string[] = [];
  const route = load("src/app/api/admin/incidents/route.ts", {
    "next/server": { NextResponse },
    "@/lib/api/auth-guard": {
      requireStaffRole: async (permission: string) => {
        assert.equal(permission, "dashboard:admin");
        return allowed ? { context: {} } : { error: NextResponse.json({ error: "Accès refusé" }, { status: 403 }) };
      },
      requireRole: () => null,
    },
    "@/lib/api/platform-access": { gatePlatformRead: async (_context: unknown, denied: Response | null) => denied },
    "@/domains/admin/incidents.service": {
      parseIncidentListParams,
      listPlatformIncidents: async () => { reads.push("read"); return { page: 1, pageSize: 25, total: 0, rows: [] }; },
    },
  });
  const get = route.GET as unknown as (request: Request) => Promise<Response>;
  assert.equal((await get(new Request("http://localhost/api/admin/incidents"))).status, 403);
  assert.equal(reads.length, 0);
  allowed = true;
  assert.equal((await get(new Request("http://localhost/api/admin/incidents?status=OPEN"))).status, 400);
  assert.equal(reads.length, 0);
  const ok = await get(new Request("http://localhost/api/admin/incidents"));
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("cache-control"), "no-store");
  assert.deepEqual(reads, ["read"]);
});
