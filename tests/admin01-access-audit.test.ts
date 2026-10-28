import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as zod from "zod";
import { NextResponse } from "next/server";
import {
  PLATFORM_ACCESS_RESOURCES,
  PLATFORM_ACCESS_RETENTION_MS,
  createPrismaPlatformAccessRepository,
  type PlatformAccessEvent,
} from "../src/domains/admin/platform-access.service";
import { PLATFORM_ACCESS_FAILURE_SIGNAL, PLATFORM_ACCESS_UNAVAILABLE, gatePlatformRead } from "../src/lib/api/platform-access";

const now = new Date("2026-01-01T00:00:00.000Z");
const routes = [
  ["src/app/api/admin/overview/route.ts", "@/domains/admin/platform.service", "OVERVIEW", false],
  ["src/app/api/admin/saas-health/route.ts", "@/domains/admin/saas-health.service", "SAAS_HEALTH", false],
  ["src/app/api/admin/service-health/route.ts", "@/domains/admin/service-health.service", "SERVICE_HEALTH", false],
  ["src/app/api/admin/companies/route.ts", "@/domains/admin/companies.service", "COMPANIES", true],
  ["src/app/api/admin/companies/[id]/route.ts", "@/domains/admin/companies.service", "COMPANY_DETAIL", false],
  ["src/app/api/admin/users/route.ts", "@/domains/admin/users.service", "USERS", true],
  ["src/app/api/admin/subscriptions/route.ts", "@/domains/admin/subscriptions.service", "SUBSCRIPTIONS", true],
  ["src/app/api/admin/support-tickets/route.ts", "@/domains/admin/support-tickets.service", "SUPPORT_TICKETS", true],
  ["src/app/api/admin/operation-jobs/route.ts", "@/domains/admin/operation-jobs.service", "OPERATION_JOBS", true],
  ["src/app/api/admin/incidents/route.ts", "@/domains/admin/incidents.service", "INCIDENTS", true],
  ["src/app/api/admin/access-events/route.ts", "@/domains/admin/platform-access.service", "ACCESS_EVENTS", true],
  ["src/app/api/admin/contact-messages/route.ts", "@/domains/growth/contact.service", "CONTACT_MESSAGES", true],
  ["src/app/api/admin/sales-codes/route.ts", "@/domains/sales/sales-code.service", "SALES_CODES", true],
  ["src/app/api/admin/sales-codes/[id]/route.ts", "@/domains/sales/sales-code.service", "SALES_COMMISSIONS", false],
] as const;

const allowedKeys = ["actorId", "decision", "expiresAt", "id", "method", "occurredAt", "resource", "role"];

function load(file: string, service: string, role: string, calls: string[], events: Array<Record<string, string>>, mode: "ok" | "fail") {
    const module = { exports: {} as { GET?: (request?: Request, context?: { params: Promise<{ id: string }> }) => Promise<Response> } };
  const source = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const sink = new Proxy({}, {
    get(_target, prop) {
      if (typeof prop !== "string") return undefined;
      if (prop.startsWith("parse")) return () => ({ query: {} });
      return async () => { calls.push("service"); return { ok: true }; };
    },
  });
  runInNewContext(source, {
    Error, URL, console, exports: module.exports, module,
    require: (id: string) => {
      if (id === "next/server") return { NextResponse };
      if (id === "zod") return zod;
      if (id === "@/lib/api/auth-guard") return {
        requireStaffRole: async (permission: string) => {
          calls.push(`staff:${permission}`);
          if (role === "ANONYMOUS") return { error: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) };
          return { context: { user: { id: "actor-secret", role: { systemRole: role } } } };
        },
        requireRole: (_context: unknown, roles: string[]) => {
          calls.push("role");
          return roles.includes(role) ? null : NextResponse.json({ error: "Accès refusé" }, { status: 403 });
        },
      };
      if (id === "@/lib/api/platform-access") return {
        gatePlatformRead: async (context: { user: { id: string; role: { systemRole: string } } }, denied: Response | null, resource: string) => {
          calls.push("audit");
          events.push({ actorId: context.user.id, role: context.user.role.systemRole, resource, decision: denied ? "DENIED" : "ALLOWED" });
          if (mode === "fail") {
            if (denied) return denied;
            return NextResponse.json({ error: PLATFORM_ACCESS_UNAVAILABLE }, { status: 503, headers: { "Cache-Control": "no-store" } });
          }
          return denied;
        },
      };
      if (id === service) return sink;
      throw new Error(id);
    },
  });
  return module.exports;
}

function watched(calls: string[]) {
  const request = new Request("http://local/api/admin/list?q=secret");
  return new Proxy(request, {
    get(target, prop, receiver) {
      if (prop === "url") calls.push("url");
      return Reflect.get(target, prop, receiver);
    },
  });
}

test("ADMIN-1 journal : une écriture par requête, avant l'URL et le service", async () => {
  assert.deepEqual([...PLATFORM_ACCESS_RESOURCES], routes.map((route) => route[2]));
  for (const [file, service, resource, usesRequest] of routes) {
    const allowedCalls: string[] = [];
    const allowedEvents: Array<Record<string, string>> = [];
    const allowed = await load(file, service, "SUPER_ADMIN", allowedCalls, allowedEvents, "ok").GET!(usesRequest ? watched(allowedCalls) : undefined, { params: Promise.resolve({ id: "company-1" }) });
    assert.equal(allowed.status, 200, file);
    assert.deepEqual(allowedEvents, [{ actorId: "actor-secret", role: "SUPER_ADMIN", resource, decision: "ALLOWED" }]);
    assert.equal(allowedCalls.filter((call) => call === "audit").length, 1);
    assert.ok(allowedCalls.indexOf("audit") < allowedCalls.indexOf("service"), file);
    if (usesRequest) assert.ok(allowedCalls.indexOf("audit") < allowedCalls.indexOf("url"), file);

    const deniedCalls: string[] = [];
    const deniedEvents: Array<Record<string, string>> = [];
    const denied = await load(file, service, "COMPANY_ADMIN", deniedCalls, deniedEvents, "ok").GET!(usesRequest ? watched(deniedCalls) : undefined);
    assert.equal(denied.status, 403, file);
    assert.deepEqual(deniedEvents, [{ actorId: "actor-secret", role: "COMPANY_ADMIN", resource, decision: "DENIED" }]);
    assert.equal(deniedCalls.includes("service") || deniedCalls.includes("url"), false);

    const failedCalls: string[] = [];
    const failed = await load(file, service, "SUPER_ADMIN", failedCalls, [], "fail").GET!(usesRequest ? watched(failedCalls) : undefined);
    assert.equal(failed.status, 503, file);
    assert.equal((await failed.json()).error, PLATFORM_ACCESS_UNAVAILABLE);
    assert.equal(failedCalls.includes("service") || failedCalls.includes("url"), false);

    const anonymousCalls: string[] = [];
    const anonymousEvents: Array<Record<string, string>> = [];
    const anonymous = await load(file, service, "ANONYMOUS", anonymousCalls, anonymousEvents, "ok").GET!();
    assert.equal(anonymous.status, 401, file);
    assert.deepEqual(anonymousEvents, []);
  }
});

test("ADMIN-1 journal : 90 jours, champs minimaux, purge atomique et lecture sans expirés", async () => {
  const stored: PlatformAccessEvent[] = [];
  let seenNow: Date | undefined;
  let created: PlatformAccessEvent | undefined;
  const repository = createPrismaPlatformAccessRepository({
    $transaction: async (run) => run({
      $transaction: async () => { throw new Error("nested"); },
      platformAccessEvent: {
        deleteMany: async (args) => {
          seenNow = args.where.expiresAt.lte;
          stored.splice(0, stored.length, ...stored.filter((entry) => entry.expiresAt > args.where.expiresAt.lte));
        },
        create: async (args) => { created = args.data; stored.push(args.data); },
        findMany: async () => [],
        count: async () => 0,
        findPage: async () => [],
      },
    }),
    platformAccessEvent: {
      deleteMany: async () => { throw new Error("hors transaction"); },
      create: async () => { throw new Error("hors transaction"); },
      count: async () => { throw new Error("hors transaction"); },
      findPage: async () => { throw new Error("hors transaction"); },
      findMany: async (args) => {
        assert.equal(args.where.expiresAt.gt.toISOString(), now.toISOString());
        const entry = created;
        if (!entry) throw new Error("événement absent");
        return [
          { ...entry, expiresAt: new Date(now.getTime() - 1) },
          entry,
        ];
      },
    },
  });
  const denied = NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  const allowed = await gatePlatformRead(
    { user: { id: "actor-secret", role: { systemRole: "SUPER_ADMIN" } } },
    null,
    "OVERVIEW",
    { now: () => now, createId: () => "event-1", repository },
  );
  assert.equal(allowed, null);
  assert.equal(stored.length, 1);
  assert.deepEqual(Object.keys(stored[0] ?? {}).sort(), allowedKeys);
  assert.equal(stored[0]?.method, "GET");
  assert.equal(stored[0]?.expiresAt.getTime() - now.getTime(), PLATFORM_ACCESS_RETENTION_MS);
  assert.equal(seenNow, now);
  assert.equal(JSON.stringify(stored).includes("http"), false);
  assert.equal(JSON.stringify(stored).includes("secret@"), false);

  const active = await repository.listActive(now);
  assert.equal(active.length, 1);
  assert.equal(active[0]?.id, "event-1");

  const logs: unknown[][] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => { logs.push(args); };
  try {
    const refused = await gatePlatformRead(
      { user: { id: "actor-secret", role: { systemRole: "DISPATCHER" } } },
      denied,
      "USERS",
      { repository: { record: async () => { throw new Error("db down"); }, listActive: async () => [], listPage: async () => { throw new Error("unused"); } } },
    );
    assert.equal(refused, denied);
    assert.deepEqual(logs, [[PLATFORM_ACCESS_FAILURE_SIGNAL]]);
    assert.equal(JSON.stringify(logs).includes("actor-secret"), false);
    const unavailable = await gatePlatformRead(
      { user: { id: "actor-secret", role: { systemRole: "SUPER_ADMIN" } } },
      null,
      "INCIDENTS",
      { repository: { record: async () => { throw new Error("db down"); }, listActive: async () => [], listPage: async () => { throw new Error("unused"); } } },
    );
    assert.equal(unavailable?.status, 503);
    assert.equal((await unavailable!.json()).error, PLATFORM_ACCESS_UNAVAILABLE);
    assert.equal(logs.length, 1);
  } finally {
    console.error = original;
  }

  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const model = schema.split("model PlatformAccessEvent")[1]?.split("model ")[0] ?? "";
  assert.equal(model.includes("@relation"), false);
  assert.equal(model.includes("@@index([occurredAt])"), true);
  assert.equal(model.includes("@@index([expiresAt])"), true);
  assert.equal(model.includes("@@index([actorId])"), true);
  const migration = readFileSync("prisma/migrations/20261025220000_platform_access_events/migration.sql", "utf8");
  assert.equal(migration.includes("CREATE TABLE \"platform_access_events\""), true);
  assert.equal(migration.includes("REFERENCES"), false);
  assert.equal(migration.includes("ACCESS_EVENTS"), true);
});

test("ADMIN-1 journal : la consultation filtre, pagine et minimise", async () => {
  const { listPlatformAccessEvents, parsePlatformAccessListParams } = await import("../src/domains/admin/platform-access.service");
  assert.equal("error" in parsePlatformAccessListParams(new URLSearchParams("q=Ada")), true);
  assert.equal((parsePlatformAccessListParams(new URLSearchParams("page=0")) as { error: string }).error, "Page invalide");
  assert.equal((parsePlatformAccessListParams(new URLSearchParams("pageSize=10")) as { error: string }).error, "Taille de page invalide");
  assert.equal((parsePlatformAccessListParams(new URLSearchParams("resource=OWNER")) as { error: string }).error, "Ressource invalide");
  const parsed = parsePlatformAccessListParams(new URLSearchParams("resource=COMPANIES&decision=ALLOWED&page=2&pageSize=50"));
  assert.ok("query" in parsed);

  let seen: { now: Date; resource?: string; decision?: string; skip: number; take: number } | undefined;
  const fresh = new Date("2026-10-25T12:00:00.000Z");
  const page = await listPlatformAccessEvents(parsed.query, {
    now: () => now,
    repository: {
      record: async () => { throw new Error("unused"); },
      listActive: async () => [],
      listPage: async (args) => {
        seen = args;
        return {
          total: 51,
          rows: [
            { id: "old", occurredAt: fresh, expiresAt: new Date(now.getTime() - 1), actorId: "a", role: "SUPER_ADMIN", method: "GET", resource: "COMPANIES", decision: "ALLOWED" },
            { id: "event-2", occurredAt: fresh, expiresAt: new Date(now.getTime() + 1000), actorId: "actor-1", role: "SUPER_ADMIN", method: "GET", resource: "COMPANIES", decision: "ALLOWED" },
          ],
        };
      },
    },
  });
  assert.equal(seen?.skip, 50);
  assert.equal(seen?.take, 50);
  assert.equal(seen?.resource, "COMPANIES");
  assert.equal(seen?.decision, "ALLOWED");
  assert.equal(seen?.now, now);
  assert.equal(page.total, 51);
  assert.equal(page.rows.length, 1);
  assert.deepEqual(Object.keys(page.rows[0] ?? {}).sort(), ["actorId", "decision", "id", "occurredAt", "resource", "role"]);
  assert.equal(JSON.stringify(page).includes("method"), false);
  assert.equal(JSON.stringify(page).includes("expiresAt"), false);

  let ordered = false;
  const paging = createPrismaPlatformAccessRepository({
    $transaction: async (run) => run({
      $transaction: async () => { throw new Error("nested"); },
      platformAccessEvent: {
        deleteMany: async () => undefined,
        create: async () => undefined,
        findMany: async () => [],
        count: async (args) => {
          assert.equal(args.where.expiresAt.gt.toISOString(), now.toISOString());
          return 0;
        },
        findPage: async (args) => {
          ordered = true;
          assert.deepEqual(args.orderBy, [{ occurredAt: "desc" }, { id: "desc" }]);
          assert.equal(args.skip, 25);
          assert.equal(args.take, 25);
          return [];
        },
      },
    }),
    platformAccessEvent: {
      deleteMany: async () => undefined,
      create: async () => undefined,
      findMany: async () => [],
      count: async () => 0,
      findPage: async () => [],
    },
  });
  await paging.listPage({ now, skip: 25, take: 25 });
  assert.equal(ordered, true);
});
