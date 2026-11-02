import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { type TestContext } from "node:test";
import { prisma } from "../src/services/prisma/client";
import { purgeDemoPoolStorage } from "../src/domains/data-lifecycle/demo-cleanup.service";
import {
  DemoPoolSafetyError,
  demoPoolLeaseKeyHash,
  demoSessionIdFromRequestKey,
  DEMO_POOL_LEASE_MS,
  DEMO_POOL_TEST_LEASE_MS,
  DEMO_POOL_RETRY_AFTER_SECONDS,
  preparePoolRecycle,
} from "../src/domains/demo/demo-pool.service";

test("DEMO-2 : clé navigateur idempotente, opaque et strictement validée", () => {
  const keyA = "12345678-1234-4234-8234-123456789abc";
  const keyB = "12345678-1234-4234-8234-123456789abd";
  const sessionA = demoSessionIdFromRequestKey(keyA);
  assert.match(sessionA, /^[a-f0-9]{64}$/);
  assert.equal(demoSessionIdFromRequestKey(keyA), sessionA);
  assert.notEqual(demoSessionIdFromRequestKey(keyB), sessionA);
  assert.notEqual(demoPoolLeaseKeyHash(sessionA), sessionA);
  assert.throws(() => demoSessionIdFromRequestKey("court"), /DEMO_REQUEST_KEY_INVALID/);
  assert.throws(() => demoPoolLeaseKeyHash("invalide"), /DEMO_SESSION_INVALID/);
});

test("DEMO-2 : durée, attente explicite et stock minimal sont codés côté serveur", () => {
  assert.equal(DEMO_POOL_LEASE_MS, 8 * 60 * 60 * 1000);
  assert.equal(DEMO_POOL_TEST_LEASE_MS, 60 * 60 * 1000, "C10 : une recette libère son espace après une heure");
  const sessionService = readFileSync("src/domains/demo/demo-session.service.ts", "utf8");
  assert.match(sessionService, /leaseMs: options\.testSession \? DEMO_POOL_TEST_LEASE_MS : DEMO_POOL_LEASE_MS/);
  for (const spec of ["navbar", "v1-roles", "v1-operational", "support", "saas03"]) {
    assert.match(readFileSync(`tests/e2e/${spec}.spec.ts`, "utf8"), /demoTestSession: true/, `${spec} annonce une recette`);
  }
  assert.equal(DEMO_POOL_RETRY_AFTER_SECONDS, 5);
  const service = readFileSync("src/domains/demo/demo-pool.service.ts", "utf8");
  const migration = readFileSync("prisma/migrations/20261022090000_demo_pool/migration.sql", "utf8");
  assert.match(service, /state: "LEASED"/);
  assert.match(service, /state: "RECYCLING"/);
  assert.match(service, /state: "QUARANTINED"/);
  assert.match(migration, /UNIQUE INDEX "demo_pool_environments_lease_key_hash_key"/);
  assert.match(migration, /UNIQUE INDEX "demo_pool_environments_pool_key_slot_key"/);
});

test("DEMO-2 : connexion et déconnexion ne construisent ni ne suppriment le scénario dans la réponse", () => {
  const login = readFileSync("src/app/api/auth/login/route.ts", "utf8");
  const logout = readFileSync("src/app/api/auth/logout/route.ts", "utf8");
  assert.doesNotMatch(login, /resetDemoScenario|ensureDemoSessionEnvironment/);
  assert.match(login, /ensureDemoSessionForLogin/);
  assert.match(login, /Retry-After/);
  assert.match(logout, /requestDemoPoolRecycle/);
  assert.match(logout, /after\(async/);
});

function poolPrepareHarness(t: TestContext, overrides: { settings?: unknown; logoUrl?: string | null } = {}) {
  const calls: string[] = [];
  const company = {
    id: "slotA",
    isDemo: true,
    status: "ACTIVE",
    logoUrl: overrides.logoUrl ?? null,
    settings: overrides.settings ?? { demoPool: true, demoPoolKey: "pool" },
    users: [],
  };
  const stubs = {
    company: { findUnique: async () => company },
    invoice: { count: async () => 0 },
    operationJob: { count: async () => 0 },
  };
  for (const [model, stub] of Object.entries(stubs)) {
    Object.defineProperty(prisma, model, { configurable: true, value: stub });
    t.after(() => { Reflect.deleteProperty(prisma, model); });
  }
  t.mock.method(prisma, "$transaction", (async () => false) as never);
  const storage = {
    purge: async () => { calls.push("purge"); },
    assertEmpty: async () => { calls.push("assertEmpty"); },
  };
  return { calls, storage };
}

test("recyclage : les preuves de la démo sont retirées avant le contrôle du dossier, sans quarantaine", async (t) => {
  const { calls, storage } = poolPrepareHarness(t);
  await preparePoolRecycle("slotA", "pool", storage);
  assert.deepEqual(calls, ["purge", "assertEmpty"]);
});

test("recyclage : une panne du retrait est retentée, un dossier resté plein met en quarantaine", async (t) => {
  const { storage } = poolPrepareHarness(t);
  const outage = await preparePoolRecycle("slotA", "pool", {
    ...storage,
    purge: async () => { throw new Error("STORAGE_UNAVAILABLE"); },
  }).catch((error: unknown) => error);
  assert.ok(outage instanceof Error && !(outage instanceof DemoPoolSafetyError));
  await assert.rejects(
    preparePoolRecycle("slotA", "pool", {
      ...storage,
      assertEmpty: async () => { throw new Error("STORAGE_OBJECTS_PRESENT"); },
    }),
    (error: unknown) => error instanceof DemoPoolSafetyError && error.message === "STORAGE_OBJECTS_PRESENT"
  );
});

test("recyclage : hors du stock de démo ou avec un logo, rien n'est retiré", async (t) => {
  await t.test("entreprise sans marqueur", async (st) => {
    const { calls, storage } = poolPrepareHarness(st, { settings: { demoSession: true } });
    await assert.rejects(preparePoolRecycle("slotA", "pool", storage), /INVALID_POOL_COMPANY/);
    assert.deepEqual(calls, []);
  });
  await t.test("autre stock", async (st) => {
    const { calls, storage } = poolPrepareHarness(st, { settings: { demoPool: true, demoPoolKey: "autre" } });
    await assert.rejects(preparePoolRecycle("slotA", "pool", storage), /INVALID_POOL_COMPANY/);
    assert.deepEqual(calls, []);
  });
  await t.test("logo", async (st) => {
    const { calls, storage } = poolPrepareHarness(st, { logoUrl: "slotA/logo.png" });
    await assert.rejects(preparePoolRecycle("slotA", "pool", storage), /EXTERNAL_ASSET_REFERENCE/);
    assert.deepEqual(calls, []);
  });
});

test("retrait du dossier : tous les fichiers de l'espace, sur plusieurs pages, jamais un sous-dossier", async () => {
  const files = Array.from({ length: 130 }, (_, index) => ({ id: `f${index}`, name: `d-${index}.jpg` }));
  const rows = [...files, { id: null, name: "sous-dossier" }];
  const removed: string[][] = [];
  const result = await purgeDemoPoolStorage("slotA", {
    list: async (path, { limit, offset }) => {
      assert.equal(path, "slotA");
      return { data: rows.slice(offset, offset + limit), error: null };
    },
    remove: async (paths) => { removed.push(paths); return { error: null }; },
  });
  assert.equal(result.removed, 130);
  assert.deepEqual(removed.map((batch) => batch.length), [100, 30]);
  assert.ok(removed.flat().every((path) => path.startsWith("slotA/d-")));
});

test("retrait du dossier : identifiant douteux ou panne de lecture, aucune suppression", async () => {
  let removals = 0;
  const remove = async () => { removals += 1; return { error: null }; };
  await assert.rejects(
    purgeDemoPoolStorage("../autre", { list: async () => ({ data: [], error: null }), remove }),
    /INVALID_ID/
  );
  await assert.rejects(
    purgeDemoPoolStorage("slotA", { list: async () => ({ data: null, error: new Error("panne") }), remove }),
    /STORAGE_UNAVAILABLE/
  );
  assert.equal(removals, 0);
});
