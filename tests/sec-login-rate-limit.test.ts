import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server";
import {
  LOGIN_EMAIL_FAILURE_LIMIT,
  LOGIN_RATE_WINDOW_MS,
  LOGIN_SOURCE_FAILURE_LIMIT,
  checkLoginRateLimit,
  clearLoginFailures,
  loginAttemptKeys,
  recordLoginFailure,
  type LoginAttemptKeys,
} from "../src/domains/auth/login-rate-limit.service";

// SEC-2 : limitation des échecs de connexion par e-mail normalisé et par source hachée.
const SECRET = "test-secret-not-a-real-key";
type Row = { keyHash: string; createdAt: Date };
function memoryDb() {
  const rows: Row[] = [];
  const db = { authLoginFailure: {
    findMany: async ({ where, orderBy, take }: { where: { keyHash: string; createdAt: { gte: Date } }; orderBy: { createdAt: "desc" }; take: number }) => {
      assert.equal(orderBy.createdAt, "desc");
      return rows.filter((row) => row.keyHash === where.keyHash && row.createdAt >= where.createdAt.gte)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, take).map(({ createdAt }) => ({ createdAt }));
    },
    createMany: async ({ data }: { data: Row[] }) => { rows.push(...data.map((row) => ({ ...row }))); return { count: data.length }; },
    deleteMany: async ({ where }: { where: { keyHash?: string; createdAt?: { lt: Date } } }) => {
      const before = rows.length;
      for (let i = rows.length - 1; i >= 0; i--) {
        const row = rows[i]!;
        if ((where.keyHash === undefined || row.keyHash === where.keyHash) && (!where.createdAt || row.createdAt < where.createdAt.lt)) rows.splice(i, 1);
      }
      return { count: before - rows.length };
    },
  } };
  return { rows, db: db as unknown as NonNullable<Parameters<typeof checkLoginRateLimit>[1]>["db"] };
}
const at = (minutes: number) => new Date(Date.UTC(2026, 9, 28, 10, 0) + minutes * 60_000);

test("empreintes : e-mail normalisé, aucune donnée brute, e-mail et source séparés", () => {
  const a = loginAttemptKeys(" Pirate@Example.TEST ", "203.0.113.7", { secret: SECRET });
  const b = loginAttemptKeys("pirate@example.test", "203.0.113.7", { secret: SECRET });
  assert.equal(a.emailKey, b.emailKey);
  assert.notEqual(a.emailKey, a.sourceKey);
  assert.doesNotMatch(JSON.stringify(a), /pirate|example|203\.0/);
  assert.notEqual(loginAttemptKeys("pirate@example.test", "203.0.113.7", { secret: "autre" }).emailKey, a.emailKey);
  assert.equal(loginAttemptKeys("demo@example.test", "203.0.113.7", { secret: SECRET, trackEmail: false }).emailKey, null);
});

test("e-mail : bloqué après la limite, Retry-After jusqu'à l'expiration, libéré ensuite", async () => {
  const { db } = memoryDb();
  const keys = loginAttemptKeys("victim@example.test", "198.51.100.1", { secret: SECRET });
  for (let i = 0; i < LOGIN_EMAIL_FAILURE_LIMIT; i++) {
    assert.deepEqual(await checkLoginRateLimit(keys, { db, now: at(i) }), { allowed: true });
    await recordLoginFailure(keys, { db, now: at(i) });
  }
  const blocked = await checkLoginRateLimit(keys, { db, now: at(LOGIN_EMAIL_FAILURE_LIMIT) });
  assert.equal(blocked.allowed, false);
  // Le plus ancien des 5 échecs (minute 0) expire à la fin de la fenêtre.
  assert.equal(!blocked.allowed && blocked.retryAfterSeconds, LOGIN_RATE_WINDOW_MS / 1000 - LOGIN_EMAIL_FAILURE_LIMIT * 60);
  // Une autre source sur le même e-mail reste bloquée (attaque distribuée).
  const otherSource = { ...keys, sourceKey: loginAttemptKeys("victim@example.test", "192.0.2.9", { secret: SECRET }).sourceKey };
  assert.equal((await checkLoginRateLimit(otherSource, { db, now: at(LOGIN_EMAIL_FAILURE_LIMIT) })).allowed, false);
  // Un autre e-mail depuis la même source reste permis sous la limite de source.
  const otherEmail = loginAttemptKeys("other@example.test", "198.51.100.1", { secret: SECRET });
  assert.equal((await checkLoginRateLimit(otherEmail, { db, now: at(LOGIN_EMAIL_FAILURE_LIMIT) })).allowed, true);
  assert.equal((await checkLoginRateLimit(keys, { db, now: new Date(at(0).getTime() + LOGIN_RATE_WINDOW_MS + 1000) })).allowed, true);
});

test("source : bloquée après la limite même en changeant d'e-mail ; un succès ne la remet pas à zéro", async () => {
  const { db } = memoryDb();
  for (let i = 0; i < LOGIN_SOURCE_FAILURE_LIMIT; i++) {
    await recordLoginFailure(loginAttemptKeys(`user${i}@example.test`, "198.51.100.2", { secret: SECRET }), { db, now: at(0) });
  }
  const fresh = loginAttemptKeys("fresh@example.test", "198.51.100.2", { secret: SECRET });
  assert.equal((await checkLoginRateLimit(fresh, { db, now: at(1) })).allowed, false);
  await clearLoginFailures(fresh, { db });
  assert.equal((await checkLoginRateLimit(fresh, { db, now: at(1) })).allowed, false);
});

test("succès : remet à zéro le compteur de l'e-mail ; échecs expirés purgés", async () => {
  const { db, rows } = memoryDb();
  const keys = loginAttemptKeys("victim@example.test", "198.51.100.3", { secret: SECRET });
  for (let i = 0; i < LOGIN_EMAIL_FAILURE_LIMIT - 1; i++) await recordLoginFailure(keys, { db, now: at(0) });
  await clearLoginFailures(keys, { db });
  assert.equal(rows.filter((row) => row.keyHash === keys.emailKey).length, 0);
  assert.equal(rows.filter((row) => row.keyHash === keys.sourceKey).length, LOGIN_EMAIL_FAILURE_LIMIT - 1);
  await recordLoginFailure(keys, { db, now: new Date(at(0).getTime() + LOGIN_RATE_WINDOW_MS + 60_000) });
  assert.equal(rows.length, 2, "seuls les deux échecs récents restent");
});

test("compte démo : seule la source est comptée, l'e-mail public ne peut pas être verrouillé", async () => {
  const { db, rows } = memoryDb();
  const keys = loginAttemptKeys("demo@example.test", "198.51.100.4", { secret: SECRET, trackEmail: false });
  await recordLoginFailure(keys, { db, now: at(0) });
  assert.deepEqual(rows.map((row) => row.keyHash), [keys.sourceKey]);
});

test("base indisponible (migration non appliquée) : connexion permise, erreur journalisée", async (t) => {
  const logged: unknown[] = [];
  t.mock.method(console, "error", (...args: unknown[]) => { logged.push(args); });
  const failing = { authLoginFailure: { findMany: async () => { throw new Error("relation does not exist"); }, createMany: async () => { throw new Error("down"); }, deleteMany: async () => { throw new Error("down"); } } };
  const db = failing as unknown as NonNullable<Parameters<typeof checkLoginRateLimit>[1]>["db"];
  const keys = loginAttemptKeys("victim@example.test", "198.51.100.5", { secret: SECRET });
  assert.deepEqual(await checkLoginRateLimit(keys, { db }), { allowed: true });
  await recordLoginFailure(keys, { db });
  await clearLoginFailures(keys, { db });
  assert.equal(logged.length, 3);
});

// Route : le contrôle précède Supabase, la réponse ne dépend pas de l'existence du compte.
function loadLoginRoute(options: { blocked?: number; signIn: "ok" | "invalid" | "down"; demo?: boolean }) {
  const calls: string[] = [];
  const afterTasks: Array<() => Promise<void>> = [];
  const user = { id: "u", email: "user@example.test", companyId: "a", company: { isDemo: false }, role: { systemRole: "CLIENT" }, settings: null };
  const deps: Record<string, unknown> = {
    "next/server": { NextResponse, after: (task: () => Promise<void>) => { afterTasks.push(task); } },
    "@/lib/auth/account-access": { assertAccountActive: () => {}, AccountUnavailableError: class extends Error {} },
    "@/lib/validations/auth": { loginSchema: { safeParse: (body: { email: string; password: string }) => ({ success: true, data: body }) } },
    "@/lib/auth/normalize-email": { normalizeEmail: (value: string) => value.trim().toLowerCase() },
    "@/services/supabase/server": { createClient: async () => ({ auth: {
      signInWithPassword: async () => {
        calls.push("signIn");
        if (options.signIn === "down") return { data: { user: null }, error: { name: "AuthRetryableFetchError", status: 0 } };
        if (options.signIn === "invalid") return { data: { user: null }, error: { name: "AuthApiError", status: 400 } };
        return { data: { user: { id: "auth", email: "user@example.test", email_confirmed_at: "2026-10-28", user_metadata: {} } }, error: null };
      },
      signOut: async () => ({ error: null }),
    } }) },
    "@/domains/auth/login-rate-limit.service": {
      loginAttemptKeys: (email: string, source: string, opts: { trackEmail?: boolean }) => {
        calls.push(`keys:${email}:${source}:${opts.trackEmail === false ? "source-only" : "email"}`);
        return { emailKey: opts.trackEmail === false ? null : "email-key", sourceKey: "source-key" } satisfies LoginAttemptKeys;
      },
      checkLoginRateLimit: async () => { calls.push("check"); return options.blocked ? { allowed: false, retryAfterSeconds: options.blocked } : { allowed: true }; },
      recordLoginFailure: async () => { calls.push("failure"); },
      clearLoginFailures: async () => { calls.push("clear"); },
    },
    "@/domains/growth/contact.service": { contactSourceFromHeaders: () => "203.0.113.10" },
    "@/domains/onboarding/onboarding.service": { resolveOnboardingLoginPath: async (_user: unknown, path: string) => path },
    "@/domains/auth/auth.service": { syncUserFromSupabase: async () => user, getDashboardPathForRole: () => "/portal", UserNotProvisionedError: class extends Error {} },
    "@/domains/user/user.service": { extractPermissionSlugs: () => [], getUserByAuthId: async () => null, updateLastLogin: async () => undefined },
    "@/lib/demo/constants": { isDemoLoginEmail: (email: string) => options.demo === true && email === "demo@example.test", DEMO_LOGIN_EMAIL: "demo@example.test" },
    "@/lib/demo/persona-cookie": {},
    "@/domains/demo/demo-auth.service": {},
    "@/domains/demo/demo-session.service": {},
    "@/domains/demo/demo-pool.service": { DemoPoolUnavailableError: class extends Error {} },
    "@/domains/saas/saas-session": { getSessionSaasAccess: async () => null },
  };
  const module = { exports: {} as { POST: (request: Request) => Promise<Response> } };
  const source = ts.transpileModule(readFileSync("src/app/api/auth/login/route.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(source, { exports: module.exports, module, console: { error() {} }, require: (id: string) => {
    assert.ok(id in deps, `Unexpected dependency ${id}`);
    return deps[id];
  } });
  return { POST: module.exports.POST, calls, runAfter: async () => { for (const task of afterTasks) await task(); } };
}
const loginRequest = (email = "User@Example.test") =>
  new Request("http://local/api/auth/login", { method: "POST", body: JSON.stringify({ email, password: "local-test-only" }) });

test("route : bloquée -> 429 en français avec Retry-After, Supabase jamais appelé", async () => {
  const route = loadLoginRoute({ blocked: 600, signIn: "ok" });
  const response = await route.POST(loginRequest());
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), "600");
  const body = await response.json();
  assert.match(body.error, /Trop de tentatives.*10 minutes/);
  assert.doesNotMatch(JSON.stringify(body), /introuvable|inexistant|existe/);
  assert.deepEqual(route.calls, ["keys:user@example.test:203.0.113.10:email", "check"]);
});

test("route : échec d'identifiants compté, panne Supabase non comptée, succès remet à zéro", async () => {
  const invalid = loadLoginRoute({ signIn: "invalid" });
  assert.equal((await invalid.POST(loginRequest())).status, 401);
  assert.deepEqual(invalid.calls.slice(1), ["check", "signIn", "failure"]);

  const down = loadLoginRoute({ signIn: "down" });
  assert.equal((await down.POST(loginRequest())).status, 503);
  assert.ok(!down.calls.includes("failure"));

  const ok = loadLoginRoute({ signIn: "ok" });
  assert.equal((await ok.POST(loginRequest())).status, 200);
  await ok.runAfter();
  assert.ok(ok.calls.includes("clear"));
  assert.ok(!ok.calls.includes("failure"));
});

test("route : compte démo public limité par source seulement", async () => {
  const route = loadLoginRoute({ signIn: "invalid", demo: true });
  await route.POST(loginRequest("demo@example.test"));
  assert.equal(route.calls[0], "keys:demo@example.test:203.0.113.10:source-only");
});
