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

test("DEMO-1 garde-fous : aucun e-mail vers une adresse de la démo, aucune notification depuis la démo", async () => {
  const { isDemoEmailAddress } = await import("@/lib/demo/demo-constants");
  const { DEMO_EMAIL_DOMAIN } = await import("@/domains/demo/demo-scenario");
  const scenario = buildDemoScenario({ slot: 2, now });
  for (const address of [...scenario.users.map((user) => user.email), ...scenario.merchants.map((m) => String(m.contactEmail)), String(scenario.company.email)]) {
    assert.ok(isDemoEmailAddress(address), address);
  }
  assert.equal(DEMO_EMAIL_DOMAIN, "demo.annona.example");
  assert.ok(isDemoEmailAddress("Contact-Demo-01@DEMO.ANNONA.EXAMPLE"));
  for (const address of ["orso@annona.fr", "client@example.com", "a@annona.example", "c@gmail.com"]) {
    assert.equal(isDemoEmailAddress(address), false, address);
  }
  const { sendTransactionalEmail } = await import("@/lib/email/transactional-email");
  let fetched = 0;
  const env = { EMAIL_DELIVERY_MODE: "live", RESEND_API_KEY: "re_test", MAIL_FROM: "no-reply@mail.annona.fr" };
  const fetcher = (async () => {
    fetched++;
    return new Response("{}");
  }) as unknown as typeof fetch;
  const result = await sendTransactionalEmail(
    { to: "demo-01-client@demo.annona.example", subject: "s", text: "t", idempotencyKey: "demo-test", replayWindowStart: null },
    { env, fetcher } as unknown as Parameters<typeof sendTransactionalEmail>[1],
  );
  assert.equal(result.status, "disabled");
  assert.equal(fetched, 0, "aucun appel au fournisseur d'e-mails");
  const push = read("src/domains/driver/driver-push.service.ts");
  assert.match(push, /if \(isDemoCompanyId\(user\.companyId\)\) return;/);
  assert.match(push, /if \(isDemoCompanyId\(input\.companyId\)\) throw skippedJobError\("DRIVER_PUSH_DEMO"\)/);
});

test("DEMO-1 garde-fous : mot de passe, comptes et suppressions refusés aux comptes de démo", async () => {
  const { demoBlockedApiReason } = await import("@/lib/demo/demo-constants");
  assert.match(demoBlockedApiReason("DELETE", "/api/orders/x")!, /suppressions/);
  for (const [method, path] of [["POST", "/api/users"], ["PATCH", "/api/users/u1"], ["POST", "/api/profile/password"], ["PATCH", "/api/profile"], ["POST", "/api/auth/password-recovery"]]) {
    assert.ok(demoBlockedApiReason(method!, path!), `${method} ${path}`);
  }
  for (const [method, path] of [["GET", "/api/users"], ["POST", "/api/orders"], ["PATCH", "/api/stops/s1"], ["POST", "/api/demo/leave"], ["DELETE", "/api/demo/leave"]]) {
    assert.equal(demoBlockedApiReason(method!, path!), null, `${method} ${path}`);
  }
  const middleware = read("src/middleware.ts");
  assert.match(middleware, /demoBlockedApiReason\(request\.method, pathname\)/);
  assert.match(middleware, /if \(!auth \|\| isDemoCompanyId\(auth\.user\.companyId\)\)/);
});

test("DEMO-1 : une réserve fraîche est prêtée sans attendre ; un environnement déjà utilisé n'en est jamais une", () => {
  const pool = read("src/domains/demo/demo-pool.service.ts");
  assert.match(pool, /WHERE "state" = 'READY' AND "prepared_at" > \$\{freshAfter\}/);
  // Rendu par « Quitter » ou préparation ratée : date de préparation effacée, donc reconstruit au prochain prêt.
  assert.match(pool, /export async function releaseDemoLease[\s\S]*?preparedAt: null/);
  assert.match(pool, /lastError: String\(error\)[\s\S]*?\}/);
  assert.equal((pool.match(/preparedAt: null/g) ?? []).length >= 3, true);
  // La réserve se prépare après la réponse au visiteur.
  assert.match(read("src/app/api/demo/start/route.ts"), /after\(\(\) => prepareSpareDemoEnvironment\(\)/);
});
