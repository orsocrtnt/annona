import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server";
import {
  LOGIN_EMAIL_FAILURE_LIMIT,
  LOGIN_PAIR_FAILURE_LIMIT,
  LOGIN_RATE_WINDOW_MS,
  LOGIN_SOURCE_FAILURE_LIMIT,
  beginLoginAttempt,
  LOGIN_CONTENTION_RETRY_SECONDS,
  loginAttemptKeys,
  settleLoginAttempt,
  startLoginAttempt,
  type LoginAttemptKeys,
} from "../src/domains/auth/login-rate-limit.service";
import * as limiter from "../src/domains/auth/login-rate-limit.service";

// SEC-2 : limitation des échecs de connexion. Chaque tentative est réservée (comptage puis
// insertion sous verrou consultatif) avant Supabase, puis soldée : échec conservé, succès
// ou panne fournisseur retirés.
const SECRET = "test-secret-not-a-real-key";
type Row = { id: string; keyHash: string; createdAt: Date };
type Db = NonNullable<Parameters<typeof beginLoginAttempt>[1]>["db"];
function memoryDb() {
  const rows: Row[] = [];
  const events: string[] = [];
  let sequence = 0;
  // Comme PostgreSQL : un tour de boucle entre lecture et écriture laisse les requêtes s'entrelacer.
  const tick = () => new Promise((done) => setImmediate(done));
  const locks = new Map<string, Promise<void>>();
  const matches = (row: Row, where: { id?: { in: string[] }; keyHash?: { in: string[] }; createdAt?: { lt: Date } }) =>
    (!where.id || where.id.in.includes(row.id)) && (!where.keyHash || where.keyHash.in.includes(row.keyHash)) && (!where.createdAt || row.createdAt < where.createdAt.lt);
  const authLoginFailure = {
    findMany: async ({ where, orderBy, take }: { where: { keyHash: string; createdAt: { gte: Date } }; orderBy: { createdAt: "desc" }; take: number }) => {
      assert.equal(orderBy.createdAt, "desc");
      await tick();
      return rows.filter((row) => row.keyHash === where.keyHash && row.createdAt >= where.createdAt.gte)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, take).map(({ createdAt }) => ({ createdAt }));
    },
    create: async ({ data }: { data: { keyHash: string; createdAt: Date } }) => {
      await tick();
      const row = { id: `row-${++sequence}`, ...data };
      rows.push(row);
      return { id: row.id };
    },
    deleteMany: async ({ where }: { where: Parameters<typeof matches>[1] }) => {
      events.push(where.createdAt ? "purge" : "delete");
      const before = rows.length;
      for (let i = rows.length - 1; i >= 0; i--) if (matches(rows[i]!, where)) rows.splice(i, 1);
      return { count: before - rows.length };
    },
  };
  const db = {
    authLoginFailure,
    $transaction: async <T>(fn: (tx: unknown) => Promise<T>) => {
      const releases: Array<() => void> = [];
      const tx = {
        authLoginFailure,
        $queryRaw: async (_strings: TemplateStringsArray, key: string) => {
          events.push("lock");
          const previous = locks.get(key) ?? Promise.resolve();
          let release = () => {};
          locks.set(key, previous.then(() => new Promise<void>((done) => { release = done; })));
          await previous;
          releases.push(release);
          return [{ locked: 1 }];
        },
      };
      try { return await fn(tx); } finally { releases.forEach((release) => release()); }
    },
  };
  return { rows, events, db: db as unknown as Db };
}
const at = (minutes: number) => new Date(Date.UTC(2026, 9, 28, 10, 0) + minutes * 60_000);
const keysFor = (email: string, source: string) => loginAttemptKeys(email, source, { secret: SECRET });
async function fail(db: Db, keys: LoginAttemptKeys, now: Date) {
  const gate = await beginLoginAttempt(keys, { db, now });
  assert.equal(gate.allowed, true);
  if (gate.allowed) await settleLoginAttempt(gate.attempt, "failure", { db, now });
}

test("empreintes : e-mail normalisé, aucune donnée brute, e-mail et source séparés", () => {
  const a = loginAttemptKeys(" Pirate@Example.TEST ", "203.0.113.7", { secret: SECRET });
  const b = loginAttemptKeys("pirate@example.test", "203.0.113.7", { secret: SECRET });
  assert.equal(a.emailKey, b.emailKey);
  assert.equal(a.pairKey, b.pairKey);
  assert.equal(new Set([a.emailKey, a.sourceKey, a.pairKey]).size, 3);
  assert.doesNotMatch(JSON.stringify(a), /pirate|example|203\.0/);
  assert.notEqual(keysFor("pirate@example.test", "203.0.113.7").emailKey, loginAttemptKeys("pirate@example.test", "203.0.113.7", { secret: "autre" }).emailKey);
  assert.equal(loginAttemptKeys("demo@example.test", "203.0.113.7", { secret: SECRET, trackEmail: false }).emailKey, null);
});

test("e-mail + source : bloqué après la limite, Retry-After jusqu'à l'expiration, libéré ensuite", async () => {
  const { db } = memoryDb();
  const keys = keysFor("victim@example.test", "198.51.100.1");
  for (let i = 0; i < LOGIN_PAIR_FAILURE_LIMIT; i++) await fail(db, keys, at(i));
  const blocked = await beginLoginAttempt(keys, { db, now: at(LOGIN_PAIR_FAILURE_LIMIT) });
  assert.equal(blocked.allowed, false);
  assert.equal(!blocked.allowed && blocked.retryAfterSeconds, LOGIN_RATE_WINDOW_MS / 1000 - LOGIN_PAIR_FAILURE_LIMIT * 60);
  const otherEmail = keysFor("other@example.test", "198.51.100.1");
  assert.equal((await beginLoginAttempt(otherEmail, { db, now: at(LOGIN_PAIR_FAILURE_LIMIT) })).allowed, true);
  assert.equal((await beginLoginAttempt(keys, { db, now: new Date(at(0).getTime() + LOGIN_RATE_WINDOW_MS + 1000) })).allowed, true);
});

test("verrouillage par un tiers : 5 échecs d'un attaquant ne bloquent pas la victime depuis sa propre source", async () => {
  const { db } = memoryDb();
  for (let i = 0; i < LOGIN_PAIR_FAILURE_LIMIT; i++) await fail(db, keysFor("victim@example.test", "203.0.113.66"), at(i));
  assert.equal((await beginLoginAttempt(keysFor("victim@example.test", "203.0.113.66"), { db, now: at(6) })).allowed, false);
  assert.equal((await beginLoginAttempt(keysFor("victim@example.test", "198.51.100.20"), { db, now: at(6) })).allowed, true);
});

test("e-mail seul : limite nettement plus haute, atteinte par une attaque distribuée", async () => {
  assert.ok(LOGIN_EMAIL_FAILURE_LIMIT >= 4 * LOGIN_PAIR_FAILURE_LIMIT);
  const { db } = memoryDb();
  for (let i = 0; i < LOGIN_EMAIL_FAILURE_LIMIT; i++) await fail(db, keysFor("victim@example.test", `198.51.100.${100 + i}`), at(0));
  assert.equal((await beginLoginAttempt(keysFor("victim@example.test", "192.0.2.200"), { db, now: at(1) })).allowed, false);
});

test("concurrence : 200 tentatives simultanées, seules les places de la limite passent", async () => {
  const { db, rows } = memoryDb();
  const keys = keysFor("victim@example.test", "198.51.100.9");
  const gates = await Promise.all(Array.from({ length: 200 }, () => beginLoginAttempt(keys, { db, now: at(0) })));
  assert.equal(gates.filter((gate) => gate.allowed).length, LOGIN_PAIR_FAILURE_LIMIT);
  assert.equal(rows.filter((row) => row.keyHash === keys.pairKey).length, LOGIN_PAIR_FAILURE_LIMIT);
});

test("source : bloquée après la limite même en changeant d'e-mail ; un succès ne la remet pas à zéro", async () => {
  const { db } = memoryDb();
  for (let i = 0; i < LOGIN_SOURCE_FAILURE_LIMIT; i++) await fail(db, keysFor(`user${i}@example.test`, "198.51.100.2"), at(0));
  const fresh = keysFor("fresh@example.test", "198.51.100.2");
  assert.equal((await beginLoginAttempt(fresh, { db, now: at(1) })).allowed, false);
});

test("succès : réservation retirée, compteurs e-mail et e-mail + source remis à zéro ; panne fournisseur non comptée", async () => {
  const { db, rows } = memoryDb();
  const keys = keysFor("victim@example.test", "198.51.100.3");
  const failures = LOGIN_PAIR_FAILURE_LIMIT - 1;
  for (let i = 0; i < failures; i++) await fail(db, keys, at(0));
  const success = await beginLoginAttempt(keys, { db, now: at(1) });
  assert.ok(success.allowed);
  await settleLoginAttempt(success.attempt, "success", { db, now: at(1) });
  assert.equal(rows.filter((row) => row.keyHash === keys.emailKey || row.keyHash === keys.pairKey).length, 0);
  assert.equal(rows.filter((row) => row.keyHash === keys.sourceKey).length, failures);
  const down = await beginLoginAttempt(keys, { db, now: at(2) });
  assert.ok(down.allowed);
  await settleLoginAttempt(down.attempt, "cancelled", { db, now: at(2) });
  assert.equal(rows.length, failures);
});

test("source inconnue (sans x-forwarded-for) : aucun seau global, seule la limite par e-mail s'applique", async () => {
  const { db, rows } = memoryDb();
  for (const source of ["unknown", "", "  "]) assert.equal(keysFor("user@example.test", source).sourceKey, null, JSON.stringify(source));
  for (let i = 0; i < LOGIN_SOURCE_FAILURE_LIMIT + 5; i++) await fail(db, keysFor(`user${i}@example.test`, "unknown"), at(0));
  assert.equal((await beginLoginAttempt(keysFor("victim@example.test", "unknown"), { db, now: at(1) })).allowed, true);
  assert.ok(rows.every((row) => row.keyHash !== keysFor("x@example.test", "unknown").sourceKey));
});

test("purge des échecs expirés occasionnelle, pas à chaque échec", async () => {
  const { db, events, rows } = memoryDb();
  const keys = keysFor("victim@example.test", "198.51.100.30");
  for (let i = 0; i < 3; i++) {
    const gate = await beginLoginAttempt(keys, { db, now: at(i) });
    assert.ok(gate.allowed);
    await settleLoginAttempt(gate.attempt, "failure", { db, now: at(i), random: () => 0.5 });
  }
  assert.equal(events.filter((event) => event === "purge").length, 0);
  const later = new Date(at(0).getTime() + LOGIN_RATE_WINDOW_MS + 5 * 60_000);
  const gate = await beginLoginAttempt(keys, { db, now: later });
  assert.ok(gate.allowed);
  await settleLoginAttempt(gate.attempt, "failure", { db, now: later, random: () => 0.001 });
  assert.equal(events.filter((event) => event === "purge").length, 1);
  assert.equal(rows.every((row) => row.createdAt >= at(0)), true);
  assert.equal(rows.filter((row) => row.createdAt < new Date(later.getTime() - LOGIN_RATE_WINDOW_MS)).length, 0);
});

test("compte démo : seule la source est comptée, l'e-mail public ne peut pas être verrouillé", async () => {
  const { db, rows } = memoryDb();
  const keys = loginAttemptKeys("demo@example.test", "198.51.100.4", { secret: SECRET, trackEmail: false });
  await fail(db, keys, at(0));
  assert.equal(keys.emailKey, null);
  assert.deepEqual(rows.map((row) => row.keyHash).sort(), [keys.pairKey, keys.sourceKey].sort());
});

test("base indisponible (migration non appliquée) : connexion permise, erreur journalisée", async (t) => {
  const logged: unknown[] = [];
  t.mock.method(console, "error", (...args: unknown[]) => { logged.push(args); });
  const failing = { $transaction: async () => { throw new Error("relation does not exist"); }, authLoginFailure: { deleteMany: async () => { throw new Error("down"); } } };
  const db = failing as unknown as Db;
  const keys = keysFor("victim@example.test", "198.51.100.5");
  const gate = await beginLoginAttempt(keys, { db });
  assert.deepEqual(gate, { allowed: true, attempt: null });
  await settleLoginAttempt(null, "failure", { db });
  await settleLoginAttempt({ keys, ids: ["x"] }, "success", { db });
  assert.equal(logged.length, 2);
});

test("contention (expiration de transaction ou de pool) : refus bref, jamais une autorisation", async (t) => {
  t.mock.method(console, "error", () => undefined);
  const keys = keysFor("victim@example.test", "198.51.100.6");
  const errors = [
    Object.assign(new Error("Transaction already closed"), { code: "P2028" }),
    Object.assign(new Error("Timed out fetching a new connection from the connection pool"), { code: "P2024" }),
    Object.assign(new Error("Raw query failed. Code: `55P03`. Message: `canceling statement due to lock timeout`"), { code: "P2010", meta: { code: "55P03" } }),
    Object.assign(new Error("Raw query failed"), { code: "P2010", meta: { code: "57014" } }),
  ];
  for (const error of errors) {
    const db = { $transaction: async () => { throw error; } } as unknown as Db;
    assert.deepEqual(await beginLoginAttempt(keys, { db }), { allowed: false, retryAfterSeconds: LOGIN_CONTENTION_RETRY_SECONDS, busy: true }, error.message);
  }
});

// Route : le contrôle précède Supabase, la réponse ne dépend pas de l'existence du compte.
function loadLoginRoute(options: { blocked?: number; busy?: boolean; signIn: "ok" | "invalid" | "down"; demo?: boolean; realLimiter?: boolean }) {
  const calls: string[] = [];
  const afterTasks: Array<() => Promise<void>> = [];
  const user = { id: "u", email: "user@example.test", companyId: "a", company: { id: "a" }, role: { systemRole: "CLIENT" }, settings: null };
  const deps: Record<string, unknown> = {
    "next/server": { NextResponse, after: (task: () => Promise<void>) => { afterTasks.push(task); } },
    "@/lib/auth/account-access": { assertAccountActive: () => {}, AccountUnavailableError: class extends Error {} },
    "@/lib/config-messages": { zodIssueMessage: (e: { issues: Array<{ message: string }> }, f: string) => e.issues[0]?.message ?? f },
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
    "@/domains/auth/login-rate-limit.service": options.realLimiter ? limiter : {
      LOGIN_BUSY_MESSAGE: limiter.LOGIN_BUSY_MESSAGE,
      loginBusyResponseInit: limiter.loginBusyResponseInit,
      startLoginAttempt: async ({ email, source, trackEmail }: { email: string; source: string; trackEmail: boolean }) => {
        calls.push(`begin:${email}:${source}:${trackEmail ? "email" : "source-only"}`);
        if (options.busy) return { allowed: false, retryAfterSeconds: limiter.LOGIN_CONTENTION_RETRY_SECONDS, busy: true };
        return options.blocked ? { allowed: false, retryAfterSeconds: options.blocked } : { allowed: true, attempt: { ids: ["r1"] } };
      },
      settleLoginAttempt: async (_attempt: unknown, outcome: string) => { calls.push(`settle:${outcome}`); },
    },
    "@/lib/security/request-source": { requestSourceFromHeaders: () => "203.0.113.10" },
    "@/domains/onboarding/onboarding.service": { resolveOnboardingLoginPath: async (_user: unknown, path: string) => path },
    "@/domains/auth/auth.service": { syncUserFromSupabase: async () => user, getDashboardPathForRole: () => "/portal", UserNotProvisionedError: class extends Error {} },
    "@/domains/user/user.service": { extractPermissionSlugs: () => [], getUserByAuthId: async () => null, updateLastLogin: async () => undefined },
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
  assert.deepEqual(route.calls, ["begin:user@example.test:203.0.113.10:email"]);
});

test("route : contention du limiteur -> 503 « service occupé », Retry-After 5, jamais « trop de tentatives »", async () => {
  const route = loadLoginRoute({ busy: true, signIn: "ok" });
  const response = await route.POST(loginRequest());
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("Retry-After"), "5");
  const body = await response.json();
  assert.equal(body.error, "Service momentanément occupé, réessayez dans quelques secondes.");
  assert.doesNotMatch(body.error, /tentatives/);
  assert.deepEqual(route.calls, ["begin:user@example.test:203.0.113.10:email"], "Supabase jamais appelé : le refus reste");
});

test("route : échec d'identifiants conservé, panne Supabase annulée, succès soldé", async () => {
  const invalid = loadLoginRoute({ signIn: "invalid" });
  assert.equal((await invalid.POST(loginRequest())).status, 401);
  assert.deepEqual(invalid.calls.slice(1), ["signIn", "settle:failure"]);

  const down = loadLoginRoute({ signIn: "down" });
  assert.equal((await down.POST(loginRequest())).status, 503);
  assert.deepEqual(down.calls.slice(1), ["signIn", "settle:cancelled"]);

  const ok = loadLoginRoute({ signIn: "ok" });
  assert.equal((await ok.POST(loginRequest())).status, 200);
  await ok.runAfter();
  assert.ok(ok.calls.includes("settle:success"));
  assert.ok(!ok.calls.includes("settle:failure"));
});

function withoutSecrets(t: test.TestContext) {
  for (const key of ["CONTACT_HMAC_SECRET", "SUPABASE_SERVICE_ROLE_KEY"]) {
    const previous = process.env[key];
    delete process.env[key];
    t.after(() => { if (previous !== undefined) process.env[key] = previous; });
  }
}

test("secret HMAC absent : tentative permise sans réservation, erreur journalisée", async (t) => {
  withoutSecrets(t);
  const logged: unknown[] = [];
  t.mock.method(console, "error", (...args: unknown[]) => { logged.push(args); });
  const { db, rows } = memoryDb();
  assert.deepEqual(await startLoginAttempt({ email: "user@example.test", source: "198.51.100.7", trackEmail: true }, { db }), { allowed: true, attempt: null });
  assert.equal(rows.length, 0);
  assert.equal(logged.length, 1);
});

test("route avec le vrai limiteur et sans secret : mauvais mot de passe -> 401, pas 500", async (t) => {
  withoutSecrets(t);
  t.mock.method(console, "error", () => {});
  const route = loadLoginRoute({ signIn: "invalid", realLimiter: true });
  assert.equal((await route.POST(loginRequest())).status, 401);
});
