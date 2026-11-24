// DEMO-1 — une démo par visiteur : prêt porté par un cookie (empreinte seule en base), comptes de démo fermés
// sans le prêt de leur environnement, table réservée au serveur.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  demoCompanyIdForSlot,
  demoEnvironmentStatus,
  hashDemoLeaseToken,
  isDemoLeaseActive,
} from "@/domains/demo/demo-pool.service";
import { buildDemoScenario } from "@/domains/demo/demo-scenario";
import {
  DEMO_FRESH_MS,
  DEMO_LEASE_MS,
  DEMO_MAX_SLOTS,
  DEMO_PREPARING_STALE_MS,
  demoFreshAfter,
  demoLeaseExpiry,
  isDemoCompanyId,
  isDemoLeaseToken,
} from "@/lib/demo/demo-constants";

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
  assert.match(read("src/features/auth/auth-form.tsx"), /<Link\s+href="\/demo"[^>]*>\s*Essayer la démo\s*<\/Link>/);
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
  assert.match(pool, /"state" = 'READY' AND "prepared_at" > \$\{freshAfter\}/);
  // Rendu par « Quitter » ou préparation ratée : date de préparation effacée, donc reconstruit au prochain prêt.
  assert.match(pool, /const RELEASED = \{ state: "READY", preparedAt: null/);
  assert.match(pool, /export async function releaseDemoLease[\s\S]*?data: RELEASED/);
  assert.match(pool, /lastError: String\(error\)[\s\S]*?\}/);
  assert.equal((pool.match(/preparedAt: null/g) ?? []).length >= 3, true);
  // La réserve se prépare après la réponse au visiteur.
  assert.match(read("src/app/api/demo/start/route.ts"), /after\(\(\) => prepareSpareDemoEnvironment\(\)/);
});

test("DEMO-1 : six démos au plus, les environnements au-delà ne sont jamais prêtés", () => {
  assert.equal(DEMO_MAX_SLOTS, 6);
  const pool = read("src/domains/demo/demo-pool.service.ts");
  assert.match(pool, /if \(slot > DEMO_MAX_SLOTS\) throw new DemoPoolFullError\(\)/);
  // Les deux prêts (réserve fraîche, environnement libre) ignorent un environnement de numéro supérieur.
  assert.equal((pool.match(/WHERE "slot" <= \$\{DEMO_MAX_SLOTS\} AND/g) ?? []).length, 2);
});

test("DEMO-1 : un prêt dure 4 heures au plus et s'arrête à la fin de la journée (minuit à Paris)", () => {
  const iso = (value: string) => demoLeaseExpiry(new Date(value)).toISOString();
  assert.equal(iso("2026-11-23T10:00:00Z"), "2026-11-23T14:00:00.000Z", "en journée : 4 heures");
  assert.equal(iso("2026-11-23T18:59:00Z"), "2026-11-23T22:59:00.000Z", "19h59 à Paris : encore 4 heures");
  assert.equal(iso("2026-11-23T21:30:00Z"), "2026-11-23T23:00:00.000Z", "22h30 à Paris (hiver) : minuit");
  assert.equal(iso("2026-07-10T21:00:00Z"), "2026-07-10T22:00:00.000Z", "23h à Paris (été) : minuit");
  assert.equal(iso("2026-11-23T23:10:00Z"), "2026-11-24T03:10:00.000Z", "0h10 à Paris : journée suivante");
  // Passé minuit, le prêt de la veille n'ouvre plus rien : l'environnement est libre, donc reconstruit au prêt suivant.
  const evening = new Date("2026-11-23T21:30:00Z");
  const lease = leased({ leaseExpiresAt: demoLeaseExpiry(evening) });
  assert.equal(isDemoLeaseActive(lease, token, new Date("2026-11-23T22:59:59Z")), true);
  assert.equal(isDemoLeaseActive(lease, token, new Date("2026-11-23T23:00:00Z")), false);
  assert.equal(demoEnvironmentStatus({ ...lease, updatedAt: evening }, new Date("2026-11-23T23:00:00Z")), "FREE");
  const pool = read("src/domains/demo/demo-pool.service.ts");
  assert.equal((pool.match(/demoLeaseExpiry\(now\)/g) ?? []).length, 2, "les deux prêts passent par la même règle");
  assert.doesNotMatch(pool, /DEMO_LEASE_MS/);
});

test("DEMO-1 : une réserve préparée la veille n'est jamais prêtée telle quelle", () => {
  const noon = new Date("2026-11-23T11:00:00Z");
  assert.equal(demoFreshAfter(noon).getTime(), noon.getTime() - DEMO_FRESH_MS);
  // 0h10 à Paris : seules les réserves préparées depuis minuit comptent, pas celle de 23h50.
  assert.equal(demoFreshAfter(new Date("2026-11-23T23:10:00Z")).toISOString(), "2026-11-23T23:00:00.000Z");
});

test("DEMO-1 : état d'une démo pour le suivi (utilisée, en préparation, libre)", () => {
  const env = (overrides: object) => ({ state: "LEASED" as const, leaseExpiresAt: new Date(now.getTime() + 1), updatedAt: now, ...overrides });
  assert.equal(demoEnvironmentStatus(null, now), "FREE", "jamais ouverte");
  assert.equal(demoEnvironmentStatus(env({}), now), "IN_USE");
  assert.equal(demoEnvironmentStatus(env({ leaseExpiresAt: now }), now), "FREE", "prêt expiré");
  assert.equal(demoEnvironmentStatus(env({ state: "READY", leaseExpiresAt: null }), now), "FREE", "rendue");
  assert.equal(demoEnvironmentStatus(env({ state: "PREPARING", leaseExpiresAt: null }), now), "PREPARING");
  const abandoned = new Date(now.getTime() - DEMO_PREPARING_STALE_MS - 1);
  assert.equal(demoEnvironmentStatus(env({ state: "PREPARING", updatedAt: abandoned }), now), "FREE", "préparation abandonnée");
});

test("DEMO-1 : se déconnecter rend la démo (bouton « Quitter » et déconnexion ordinaire)", async (t) => {
  assert.match(read("src/features/demo/demo-bar.tsx"), /fetch\("\/api\/demo\/leave", \{ method: "POST" \}\)/);
  // Déconnexion ordinaire (menu du compte) : la démo est rendue, un vrai compte n'appelle rien.
  assert.match(read("src/hooks/use-auth.ts"), /await releaseDemoOnLogout\(user\)/);
  const { releaseDemoOnLogout } = await import("@/lib/demo/demo-logout");
  const calls: Array<[string, string | undefined]> = [];
  t.mock.method(globalThis, "fetch", async (url: string, init?: RequestInit) => {
    calls.push([url, init?.method]);
    throw new Error("réseau coupé");
  });
  for (const companyId of [null, undefined, "cmabc123"]) await releaseDemoOnLogout({ companyId });
  assert.deepEqual(calls, [], "vrai compte (super admin sans entreprise compris)");
  await releaseDemoOnLogout({ companyId: "demopool_04_company" });
  assert.deepEqual(calls, [["/api/demo/leave", "POST"]], "un échec réseau ne bloque pas la déconnexion");
  // Trouvé à la recette du 23 novembre : déconnexion cliquée avant que la page connaisse le compte.
  for (const unknown of [null, undefined]) await releaseDemoOnLogout(unknown);
  assert.equal(calls.length, 3, "compte pas encore connu : la démo est rendue quand même");
  const leave = read("src/app/api/demo/leave/route.ts");
  assert.match(leave, /await releaseDemoLease\(token\);\s*await clearDemoLeaseCookie\(\);/);
  // Une démo remise à neuf est préparée après la réponse, pour le visiteur suivant.
  assert.match(leave, /after\(\(\) => prepareSpareDemoEnvironment\(\)/);
});

test("DEMO-1 « Tout déconnecter » : réservé au super admin, tous les prêts rendus, préparations en cours intactes", () => {
  const route = read("src/app/api/admin/demos/reset/route.ts");
  assert.match(route, /requireStaffRole\("dashboard:admin"\)[\s\S]*requireRole\(auth\.context, \["SUPER_ADMIN"\]\)[\s\S]*releaseAllDemoLeases\(\)/);
  const pool = read("src/domains/demo/demo-pool.service.ts");
  const releaseAll = pool.split("export async function releaseAllDemoLeases")[1]?.split("export ")[0] ?? "";
  assert.match(releaseAll, /updateMany\(\{ where: \{ state: "LEASED" \}, data: RELEASED \}\)/);
  assert.doesNotMatch(releaseAll, /PREPARING/);
  assert.match(pool, /const RELEASED = \{ state: "READY", preparedAt: null, leaseKeyHash: null, leasedAt: null, leaseExpiresAt: null \}/);
  const page = read("src/app/(back-office)/admin/demos/page.tsx");
  assert.match(page, /Tout déconnecter/);
  assert.match(page, /Déconnecter toutes les démos \?/);
});
