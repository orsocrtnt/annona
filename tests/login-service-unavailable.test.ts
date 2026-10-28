import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { NextResponse } from "next/server";
import ts from "typescript";

type SignInResult = { data: { user: unknown }; error: unknown };

function loadLoginRoute(signIn: () => Promise<SignInResult>, syncUser: () => Promise<unknown>) {
  const module = { exports: {} as { POST: (request: Request) => Promise<Response> } };
  const dependencies: Record<string, unknown> = {
    "next/server": { NextResponse, after: () => undefined },
    "@/lib/auth/account-access": { assertAccountActive: () => {}, AccountUnavailableError: class extends Error {} },
    "@/lib/validations/auth": { loginSchema: { safeParse: () => ({ success: true, data: { email: "user@fixture.invalid", password: "fixture-password" } }) } },
    "@/lib/auth/normalize-email": { normalizeEmail: (value: string) => value },
    "@/services/supabase/server": { createClient: async () => ({ auth: { signInWithPassword: signIn, signOut: async () => undefined } }) },
    "@/domains/onboarding/onboarding.service": { resolveOnboardingLoginPath: async (_user: unknown, path: string) => path },
    "@/domains/auth/login-rate-limit.service": { loginAttemptKeys: () => ({ emailKey: "e", sourceKey: "s" }), checkLoginRateLimit: async () => ({ allowed: true }), recordLoginFailure: async () => {}, clearLoginFailures: async () => {} },
    "@/domains/growth/contact.service": { contactSourceFromHeaders: () => "test-source" },
    "@/domains/auth/auth.service": { syncUserFromSupabase: syncUser, getDashboardPathForRole: () => "/dashboard", UserNotProvisionedError: class extends Error {} },
    "@/domains/user/user.service": { extractPermissionSlugs: () => [], getUserByAuthId: async () => null, updateLastLogin: async () => undefined },
    "@/lib/demo/constants": { isDemoLoginEmail: () => false, DEMO_LOGIN_EMAIL: "demo@fixture.invalid" },
    "@/lib/demo/persona-cookie": { setDemoPersonaCookie: async () => {}, clearDemoPersonaCookie: async () => {}, clearDemoSessionCookie: async () => {} },
    "@/domains/demo/demo-auth.service": { resolveDemoActiveUser: async () => null },
    "@/domains/demo/demo-session.service": { ensureDemoSessionForLogin: async () => "company" },
    "@/domains/demo/demo-pool.service": {
      DemoPoolUnavailableError: class extends Error {},
      maintainDemoPool: async () => [],
      requestDemoPoolRecycle: async () => false,
      recycleDemoPoolEnvironment: async () => ({ status: "ready" }),
    },
    "@/domains/saas/saas-session": { getSessionSaasAccess: async () => null },
  };
  const source = ts.transpileModule(readFileSync("src/app/api/auth/login/route.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  runInNewContext(source, { exports: module.exports, module, console: { error() {} }, require: (id: string) => dependencies[id] });
  return module.exports.POST;
}

const request = () => new Request("https://fixture.invalid/api/auth/login", { method: "POST", body: "{}" });
const confirmedUser = { id: "auth", email: "user@fixture.invalid", email_confirmed_at: "2026-10-26", user_metadata: {} };

test("connexion : un identifiant refusé reste un 401 « mot de passe incorrect »", async () => {
  const POST = loadLoginRoute(
    async () => ({ data: { user: null }, error: { name: "AuthApiError", status: 400, code: "invalid_credentials" } }),
    async () => { throw new Error("ne doit pas être appelé"); }
  );
  const response = await POST(request());
  assert.equal(response.status, 401);
  assert.match((await response.json()).error, /mot de passe incorrect/);
});

test("connexion : une panne Supabase Auth n'est pas présentée comme un mauvais mot de passe", async () => {
  for (const error of [
    { name: "AuthRetryableFetchError", status: 0, message: "fetch failed" },
    { name: "AuthApiError", status: 503, message: "upstream unavailable" },
  ]) {
    const POST = loadLoginRoute(async () => ({ data: { user: null }, error }), async () => null);
    const response = await POST(request());
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.doesNotMatch(body.error, /mot de passe/);
    assert.match(body.error, /indisponible/);
  }
});

test("connexion : une base injoignable ou un pool saturé renvoie 503, pas 500", async () => {
  for (const failure of [
    Object.assign(new Error("Timed out fetching a new connection"), { code: "P2024" }),
    Object.assign(new Error("Can't reach database server"), { name: "PrismaClientInitializationError" }),
  ]) {
    const POST = loadLoginRoute(
      async () => ({ data: { user: confirmedUser }, error: null }),
      async () => { throw failure; }
    );
    const response = await POST(request());
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /indisponible/);
  }
});

test("connexion : une erreur inattendue reste un 500", async () => {
  const POST = loadLoginRoute(
    async () => ({ data: { user: confirmedUser }, error: null }),
    async () => { throw new Error("bug"); }
  );
  assert.equal((await POST(request())).status, 500);
});
