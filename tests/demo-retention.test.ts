import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as crypto from "node:crypto";
import ts from "typescript";
import { prisma } from "../src/services/prisma/client";
import { demoRetentionSettings, demoSessionExpiry } from "../src/lib/demo/retention";
import { demoPersonaSeedUsers } from "../src/domains/demo/demo-users.service";
import { demoFixtureAuthId } from "../src/lib/demo/constants";
import {
  cleanupDemoSessionOnLogout,
  cleanupExpiredDemoSession,
  DEMO_CLEANUP_AUTHORIZATION,
  DEMO_LOGOUT_CLEANUP_AUTHORIZATION,
} from "../src/domains/data-lifecycle/demo-cleanup.service";
import * as constants from "../src/lib/demo/constants";
import * as retention from "../src/lib/demo/retention";
import * as access from "../src/lib/auth/account-access";

const createdAt = new Date("2026-10-18T00:00:00.000Z");
const now = new Date("2026-10-18T10:00:00.000Z");
function company() {
  return { id: "fixtureA", isDemo: true, status: "ACTIVE", slug: `logiexpress-demo-session-${"a".repeat(24)}`, createdAt, updatedAt: createdAt, logoUrl: null,
    settings: { demoSession: true, demoRetention: demoRetentionSettings(createdAt) } };
}

test("demo retention requires all markers and an exact eight-hour persisted expiry", () => {
  const c = company();
  assert.equal(demoSessionExpiry(c)?.toISOString(), "2026-10-18T08:00:00.000Z");
  for (const variant of [
    { ...c, isDemo: false }, { ...c, slug: "logiexpress-demo" }, { ...c, slug: `${c.slug}-suffix` },
    { ...c, settings: { demoSession: true } }, { ...c, settings: null },
    { ...c, settings: { demoSession: true, demoRetention: { version: 2, expiresAt: "2026-10-18T08:00:00.000Z" } } },
    { ...c, settings: { demoSession: true, demoRetention: { version: 1, expiresAt: "2026-10-18T00:00:00.000Z" } } },
  ]) assert.equal(demoSessionExpiry(variant), null);
});

function harness(t: TestContext) {
  const c = company();
  const users = demoPersonaSeedUsers(c.id).map((seed) => {
    const [local, domain] = seed.email.split("@");
    return { ...seed, id: seed.authId ?? "admin", authId: seed.authId ?? demoFixtureAuthId("admin", c.id), email: `${local}+session-${c.id}@${domain}`, role: { slug: seed.roleSlug }, avatarUrl: null };
  });
  const calls: string[] = [];
  const counts: Record<string, number> = {};
  const tx = Object.fromEntries(["order", "delivery", "invoice", "recurringOrder", "supportTicket", "orderMessage", "orderThreadRead", "clientNotification", "orderItem", "supportTicketMessage", "operationJob"].map((name) => [name, {
    count: async () => counts[name] ?? 0,
    deleteMany: async () => { calls.push(`delete:${name}`); return { count: 1 }; },
  }]));
  Object.assign(tx, {
    company: { findUnique: async () => c, updateMany: async () => { calls.push("lock"); return { count: 1 }; }, delete: async () => { calls.push("delete:company"); } },
    user: { findMany: async () => users, deleteMany: async () => { calls.push("delete:user"); return { count: 8 }; } },
  });
  t.mock.method(prisma, "$transaction", async (fn: (tx: unknown) => Promise<unknown>, options: { isolationLevel: string }) => { assert.equal(options.isolationLevel, "Serializable"); return fn(tx); });
  const options = { now, assertStorageEmpty: async () => { calls.push("storage:read"); } };
  return { c, users, calls, counts, options };
}

test("demo cleanup is read-only by default and requires explicit activation", async (t) => {
  const h = harness(t);
  assert.deepEqual(await cleanupExpiredDemoSession(h.c.id, h.options), { status: "eligible" });
  assert.deepEqual(h.calls, ["storage:read"]);
  h.calls.length = 0;
  assert.deepEqual(await cleanupExpiredDemoSession(h.c.id, { ...h.options, apply: true }), { status: "blocked", reason: "EXPLICIT_ACTIVATION_REQUIRED" });
  assert.deepEqual(h.calls, []);
});

test("demo cleanup keeps active, grace-period, legacy and normal companies", async (t) => {
  const h = harness(t);
  for (const [date, reason] of [["07:59", "ACTIVE_SESSION"], ["08:59", "IN_FLIGHT_GRACE"]]) {
    assert.deepEqual(await cleanupExpiredDemoSession(h.c.id, { ...h.options, now: new Date(`2026-10-18T${date}:00Z`) }), { status: "blocked", reason });
  }
  h.c.isDemo = false;
  assert.equal((await cleanupExpiredDemoSession(h.c.id, h.options)).reason, "UNMANAGED_OR_NON_DEMO");
  assert.deepEqual(h.calls, []);
});

test("demo cleanup rejects an unexpected Auth identity and any changed roster", async (t) => {
  const h = harness(t);
  h.users[0]!.authId = "a-real-auth-uuid";
  assert.equal((await cleanupExpiredDemoSession(h.c.id, h.options)).reason, "NON_SYNTHETIC_OR_CHANGED_ROSTER");
  assert.deepEqual(h.calls, []);
});

test("demo cleanup blocks cross-tenant cascades, external assets and running jobs", async (t) => {
  const h = harness(t);
  for (const [model, reason] of [["order", "CROSS_TENANT_REFERENCE"], ["supportTicketMessage", "CROSS_TENANT_REFERENCE"], ["orderItem", "CROSS_TENANT_REFERENCE"], ["clientNotification", "CROSS_TENANT_REFERENCE"], ["delivery", "EXTERNAL_ASSET_REFERENCE"], ["invoice", "EXTERNAL_ASSET_REFERENCE"], ["operationJob", "UNFINISHED_JOBS"]]) {
    h.counts[model!] = 1;
    assert.equal((await cleanupExpiredDemoSession(h.c.id, h.options)).reason, reason);
    delete h.counts[model!];
  }
  assert.deepEqual(h.calls, []);
});

test("demo cleanup never reaches deletes on Storage failure, then can be retried", async (t) => {
  const h = harness(t);
  const options = { ...h.options, apply: true, authorization: DEMO_CLEANUP_AUTHORIZATION };
  await assert.rejects(cleanupExpiredDemoSession(h.c.id, { ...options, assertStorageEmpty: async () => { throw new Error("unavailable"); } }), /unavailable/);
  assert.deepEqual(h.calls, ["lock"]);
  h.calls.length = 0;
  assert.deepEqual(await cleanupExpiredDemoSession(h.c.id, options), { status: "deleted" });
  assert.equal(h.calls[0], "lock");
  assert.equal(h.calls[1], "storage:read");
  assert.equal(h.calls.at(-1), "delete:company");
});

test("demo logout deletes the current active synthetic session only with its dedicated authorization", async (t) => {
  const h = harness(t);
  const activeNow = new Date("2026-10-18T01:00:00.000Z");
  assert.deepEqual(
    await cleanupDemoSessionOnLogout(h.c.id, { now: activeNow, assertStorageEmpty: h.options.assertStorageEmpty }),
    { status: "blocked", reason: "EXPLICIT_ACTIVATION_REQUIRED" }
  );
  assert.deepEqual(h.calls, []);
  assert.deepEqual(
    await cleanupDemoSessionOnLogout(h.c.id, {
      now: activeNow,
      authorization: DEMO_LOGOUT_CLEANUP_AUTHORIZATION,
      assertStorageEmpty: h.options.assertStorageEmpty,
    }),
    { status: "deleted" }
  );
  assert.equal(h.calls[0], "lock");
  assert.equal(h.calls.at(-1), "delete:company");
});

function sessionModule(c: ReturnType<typeof company> | null) {
  const testModule = { exports: {} };
  const dependencies: Record<string, unknown> = {
    "node:crypto": crypto,
    "@/services/prisma/client": { prisma: { company: { findUnique: async () => c } } },
    "@/lib/demo/constants": constants,
    "@/domains/demo/demo-users.service": {},
    "@/domains/demo/demo-scenario.service": {},
    "@/lib/validations/dispatch-settings": { DEFAULT_DISPATCH_SETTINGS: {} },
    "@/lib/demo/retention": retention,
    "@/lib/auth/account-access": access,
    "@/domains/demo/demo-pool.service": {
      getActiveDemoPoolLease: async () => null,
      demoSessionIdFromRequestKey: () => "b".repeat(64),
      leaseDemoPoolEnvironment: async () => assert.fail("legacy retention test must not lease pool"),
    },
    "@/lib/demo/persona-cookie": { getDemoSessionCookie: async () => "a".repeat(64) },
  };
  const source = ts.transpileModule(readFileSync("src/domains/demo/demo-session.service.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(source, { module: testModule, exports: testModule.exports, Date, require: (name: string) => {
    assert.ok(name in dependencies, name);
    return dependencies[name];
  } });
  return testModule.exports as typeof import("../src/domains/demo/demo-session.service");
}

test("demo expiry is enforced server-side even if the old cookie is replayed after cleanup", async () => {
  const c = company();
  c.createdAt = new Date(Date.now() - 10 * 60 * 60 * 1000);
  c.settings.demoRetention = demoRetentionSettings(c.createdAt);
  await assert.rejects(sessionModule(c).getDemoSessionCompanyId(), access.AccountUnavailableError);
  await assert.rejects(sessionModule(null).getDemoSessionCompanyId(), access.AccountUnavailableError);
  c.createdAt = new Date();
  c.settings.demoRetention = demoRetentionSettings(c.createdAt);
  assert.equal(await sessionModule(c).getDemoSessionCompanyId(), c.id);
});

test("a legacy session without exact retention metadata stays inaccessible", async () => {
  const c = company();
  c.settings = { demoSession: true } as typeof c.settings;
  await assert.rejects(sessionModule(c).getDemoSessionCompanyId(), access.AccountUnavailableError);
  await assert.rejects(
    sessionModule(c).ensureDemoSessionEnvironment("base", "a".repeat(64)),
    /DEMO_SESSION_UNAVAILABLE/
  );
});

test("an expired session cannot be rebuilt through environment reuse", async () => {
  const c = company();
  c.createdAt = new Date(Date.now() - 10 * 60 * 60 * 1000);
  c.settings.demoRetention = demoRetentionSettings(c.createdAt);
  await assert.rejects(sessionModule(c).ensureDemoSessionEnvironment("base", "a".repeat(64)), /DEMO_SESSION_UNAVAILABLE/);
});
