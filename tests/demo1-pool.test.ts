// DEMO-1 — une démo par visiteur : prêt porté par un cookie (empreinte seule en base), comptes de démo fermés
// sans le prêt de leur environnement, table réservée au serveur.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  demoCompanyIdForSlot,
  hashDemoLeaseToken,
  isDemoLeaseActive,
} from "@/domains/demo/demo-pool.service";
import { buildDemoScenario } from "@/domains/demo/demo-scenario";
import { DEMO_LEASE_MS, isDemoCompanyId, isDemoLeaseToken } from "@/lib/demo/demo-constants";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const token = "a".repeat(64);
const now = new Date("2026-11-23T10:00:00Z");
const leased = (overrides: Partial<Parameters<typeof isDemoLeaseActive>[0] & object> = {}) => ({
  state: "LEASED" as const,
  leaseKeyHash: hashDemoLeaseToken(token),
  leaseExpiresAt: new Date(now.getTime() + DEMO_LEASE_MS),
  ...overrides,
});

test("DEMO-1 : l'entreprise d'un environnement est reconnue, celle des vrais clients jamais", () => {
  assert.equal(demoCompanyIdForSlot(3), "demopool_03_company");
  assert.equal(demoCompanyIdForSlot(3), buildDemoScenario({ slot: 3, now }).companyId);
  assert.ok(isDemoCompanyId("demopool_03_company"));
  for (const id of [null, undefined, "", "cmabc123", "demopool_03_user_admin", "xdemopool_03_company"]) {
    assert.equal(isDemoCompanyId(id), false, String(id));
  }
});

test("DEMO-1 : le jeton de prêt n'ouvre que son environnement, prêté et non expiré", () => {
  assert.ok(isDemoLeaseToken(token));
  assert.equal(isDemoLeaseToken("abc"), false);
  assert.notEqual(hashDemoLeaseToken(token), token);
  assert.equal(isDemoLeaseActive(leased(), token, now), true);
  assert.equal(isDemoLeaseActive(leased(), "b".repeat(64), now), false, "jeton d'un autre visiteur");
  assert.equal(isDemoLeaseActive(leased(), undefined, now), false, "sans cookie");
  assert.equal(isDemoLeaseActive(leased({ leaseExpiresAt: new Date(now.getTime() - 1) }), token, now), false, "prêt expiré");
  assert.equal(isDemoLeaseActive(leased({ state: "PREPARING" }), token, now), false, "encore en préparation");
  assert.equal(isDemoLeaseActive(leased({ state: "READY", leaseKeyHash: null }), token, now), false, "rendu");
  assert.equal(isDemoLeaseActive(null, token, now), false);
});

test("DEMO-1 : un compte de démo ne s'ouvre qu'avec le cookie de prêt (pages et API)", () => {
  const serverAuth = read("src/lib/api/server-auth.ts");
  assert.match(serverAuth, /isDemoCompanyId\(user\.companyId\) && !\(await hasActiveDemoLease\(user\.companyId, demoLeaseToken\)\)\) return null/);
  assert.match(serverAuth, /cookies\(\)\)\.get\(DEMO_LEASE_COOKIE\)/);
  const middleware = read("src/middleware.ts");
  // Le sujet mémorisé 5 s dépend du cookie : un prêt repris par un autre visiteur ne reste pas ouvert.
  assert.match(middleware, /const key = `\$\{authId\}:\$\{demoLeaseToken \?\? ""\}`/);
  assert.match(middleware, /loadSubject\(authId, demoLeaseToken\)/);
});

test("DEMO-1 : jeton aléatoire en cookie HttpOnly, empreinte seule en base, table fermée à l'API publique", () => {
  const cookie = read("src/lib/demo/demo-lease-cookie.ts");
  assert.match(cookie, /httpOnly: true/);
  const pool = read("src/domains/demo/demo-pool.service.ts");
  assert.match(pool, /randomBytes\(32\)/);
  assert.match(pool, /FOR UPDATE SKIP LOCKED/);
  const migration = read("prisma/migrations/20261123120000_demo1_pool/migration.sql");
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  for (const role of ["anon", "authenticated"]) assert.match(migration, new RegExp(`REVOKE ALL PRIVILEGES ON TABLE "demo_pool_environments" FROM ${role}`));
});

test("DEMO-1 : connexion sans identifiants par lien généré côté serveur, sans envoi d'e-mail", () => {
  const session = read("src/domains/demo/demo-session.service.ts");
  assert.match(session, /generateLink\(\{ type: "magiclink"/);
  assert.match(session, /verifyOtp\(\{ type: "email", token_hash: tokenHash \}\)/);
  assert.match(session, /findDemoLease\(leaseToken\)/);
  assert.doesNotMatch(session, /signInWithOtp|inviteUserByEmail/);
  // La page de connexion mène à la démo.
  assert.match(read("src/features/auth/auth-form.tsx"), /href="\/demo"[\s\S]*Voir la démo/);
});
