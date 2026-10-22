import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  demoPoolLeaseKeyHash,
  demoSessionIdFromRequestKey,
  DEMO_POOL_LEASE_MS,
  DEMO_POOL_RETRY_AFTER_SECONDS,
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
