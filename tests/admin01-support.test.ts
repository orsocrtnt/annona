import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server";
import {
  listPlatformSupportTickets,
  parseSupportTicketListParams,
  platformSupportTicketSelect,
  type SupportTicketListParams,
} from "../src/domains/admin/support-tickets.service";

function load(file: string, dependencies: Record<string, unknown>) {
  const module = { exports: {} as Record<string, (...args: never[]) => Promise<unknown>> };
  const source = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  runInNewContext(source, {
    Error,
    Date,
    URL,
    exports: module.exports,
    module,
    require: (id: string) => {
      assert.ok(id in dependencies, `Unexpected dependency ${id}`);
      return dependencies[id];
    },
  });
  return module.exports;
}

test("ADMIN-1 support : recherche, filtres, pagination sûre et select minimal", async () => {
  assert.ok("error" in parseSupportTicketListParams(new URLSearchParams(`page=${"9".repeat(400)}`)));
  assert.equal(
    (parseSupportTicketListParams(new URLSearchParams("page=90071992547411&pageSize=100")) as { error: string }).error,
    "Page invalide"
  );
  assert.ok("error" in parseSupportTicketListParams(new URLSearchParams("priority=CRITICAL")));

  const parsed = parseSupportTicketListParams(new URLSearchParams("q=  Acme  &status=OPEN&priority=URGENT&page=2&pageSize=50"));
  assert.ok("query" in parsed);
  const calls: string[] = [];
  const page = await listPlatformSupportTickets(parsed.query as SupportTicketListParams, {
    supportTicket: {
      count: async (args) => {
        calls.push("count");
        assert.equal((args.where as { company: { name: { contains: string } } }).company.name.contains, "Acme");
        assert.equal((args.where as { status: string }).status, "OPEN");
        assert.equal((args.where as { priority: string }).priority, "URGENT");
        return 1;
      },
      findMany: async (args) => {
        calls.push("findMany");
        assert.deepEqual(args.orderBy, [{ updatedAt: "desc" }, { id: "desc" }]);
        assert.equal(args.skip, 50);
        assert.equal(args.take, 50);
        const select = platformSupportTicketSelect();
        for (const forbidden of ["subject", "message", "messages", "customerId", "customer", "relatedOrderId", "relatedDeliveryId"]) {
          assert.equal(forbidden in select, false);
        }
        return [{
          id: "ticket-1",
          status: "OPEN" as const,
          priority: "URGENT" as const,
          contactType: "DRIVER" as const,
          relatedOrder: { reference: "CMD-1001" },
          relatedDelivery: null,
          createdAt: new Date("2026-10-25T08:00:00.000Z"),
          updatedAt: new Date("2026-10-25T09:00:00.000Z"),
          company: { name: "Acme" },
        }];
      },
    },
  });

  assert.deepEqual(calls, ["count", "findMany"]);
  assert.equal(page.rows[0]?.company, "Acme");
  assert.equal(page.rows[0]?.relatedOrderReference, "CMD-1001");
  assert.equal(page.rows[0]?.relatedDeliveryReference, null);
  assert.equal(JSON.stringify(page).includes("relatedOrderId"), false);
  assert.equal(JSON.stringify(page).includes("relatedDeliveryId"), false);
  assert.equal(JSON.stringify(page).includes("subject"), false);
  assert.equal(JSON.stringify(page).includes("@"), false);
});

test("ADMIN-1 support : accès refusé avant lecture, validation stricte, aucune écriture", async () => {
  let allowed = false;
  const reads: string[] = [];
  const route = load("src/app/api/admin/support-tickets/route.ts", {
    "next/server": { NextResponse },
    "@/lib/api/auth-guard": {
      requireStaffRole: async (permission: string) => {
        assert.equal(permission, "dashboard:admin");
        return allowed
          ? { context: { user: { id: "staff" } } }
          : { error: NextResponse.json({ error: "Accès refusé" }, { status: 403 }) };
      },
      requireRole: () => null,
    },
    "@/lib/api/platform-access": { gatePlatformRead: async (_context: unknown, denied: Response | null) => denied },
    "@/domains/admin/support-tickets.service": {
      parseSupportTicketListParams,
      listPlatformSupportTickets: async () => {
        reads.push("read");
        return { page: 1, pageSize: 25, total: 0, rows: [] };
      },
    },
  });
  const get = route.GET as unknown as (request: Request) => Promise<Response>;
  assert.equal((await get(new Request("http://localhost/api/admin/support-tickets"))).status, 403);
  assert.equal(reads.length, 0);

  allowed = true;
  assert.equal((await get(new Request("http://localhost/api/admin/support-tickets?pageSize=10"))).status, 400);
  assert.equal(reads.length, 0);

  const ok = await get(new Request("http://localhost/api/admin/support-tickets"));
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("cache-control"), "no-store");
  assert.deepEqual(reads, ["read"]);
});
