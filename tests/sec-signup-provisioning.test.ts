import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as zod from "zod";
import { NextResponse } from "next/server";
import type { SystemRole, UserWithRole } from "../src/types";
import * as access from "../src/lib/auth/account-access";
import * as userService from "../src/domains/user/user.service";
import * as authValidation from "../src/lib/validations/auth";
import * as normalize from "../src/lib/auth/normalize-email";
import * as constants from "../src/lib/demo/constants";

// SEC-1 : l'auto-inscription ne provisionne jamais d'entreprise ni d'abonnement LEGACY.
// Seul le parcours SignupJourney vérifié côté serveur crée une entreprise.
function load<T>(file: string, dependencies: Record<string, unknown>): T {
  const module = { exports: {} };
  const deps = { "server-only": {}, "next/server": { NextResponse, after: () => undefined }, ...dependencies };
  const source = ts.transpileModule(readFileSync(resolve(file), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(source, { Error, console, exports: module.exports, module, require: (id: string) => {
    assert.ok(id in deps, `Unexpected dependency ${id}`);
    return deps[id as keyof typeof deps];
  } });
  return module.exports as T;
}
function user(role: SystemRole): UserWithRole {
  return {
    id: "u", authId: "auth", email: "local@example.com", firstName: "Test", lastName: "Local",
    status: "ACTIVE", companyId: "a", roleId: "r", createdAt: new Date(), updatedAt: new Date(), settings: null,
    role: { id: "r", name: "Role", slug: "role", systemRole: role, isSystem: true, permissions: [] },
    company: { id: "a", status: "ACTIVE", isDemo: false },
  } as unknown as UserWithRole;
}

const FORGED_METADATA = { account_type: "company", company_name: "Entreprise pirate", first_name: "Test", last_name: "Local" };
type AuthService = typeof import("../src/domains/auth/auth.service");

// Service réel chargé isolément ; toute écriture de provisionnement est journalisée et refusée.
function authFixture(existing: UserWithRole | null = null, byEmail: UserWithRole | null = null) {
  const writes: string[] = [];
  const updates: Array<{ data: Record<string, unknown> }> = [];
  let links = 0;
  const refuse = (name: string) => async () => { writes.push(name); throw new Error(`${name} interdit`); };
  const prisma = {
    user: {
      findFirst: async () => byEmail ? structuredClone(byEmail) : null, count: async () => 0, create: refuse("user.create"),
      update: async (args: { data: Record<string, unknown> }) => { updates.push(args); return existing ?? byEmail; },
    },
    company: { findFirst: async () => { writes.push("company.findFirst"); return { id: "first-company" }; }, create: refuse("company.create") },
    saasSubscription: { create: refuse("subscription.create") },
    role: { findUnique: async () => ({ id: "role-admin", slug: "company-admin" }) },
  };
  const service = load<AuthService>("src/domains/auth/auth.service.ts", {
    "@/lib/auth/account-access": access,
    "@/services/prisma/client": { prisma },
    "@/domains/client-portal/client-data.service": { linkPortalDataToClient: async () => { links++; } },
    "@/domains/user/user.service": {
      getUserByAuthId: async () => existing ? structuredClone(existing) : null,
      hydrateUserWithRole: async (u: object) => ({ ...u, role: existing?.role }),
    },
    "@/lib/auth/normalize-email": normalize,
    "@/lib/utils": { slugify: (v: string) => v },
    "@/lib/permissions/page-access": { getRoleHomePath: () => "/dashboard" },
  });
  return { service, writes, updates, links: () => links };
}
const FORGED_INPUT = { authId: "auth", email: "pirate@example.test", firstName: "Test", lastName: "Local", accountType: "company", companyName: "Entreprise pirate" };

test("synchronisation : accountType company et nom d'entreprise ne créent ni entreprise ni abonnement", async () => {
  const f = authFixture();
  await assert.rejects(f.service.syncUserFromSupabase(FORGED_INPUT as Parameters<AuthService["syncUserFromSupabase"]>[0]), f.service.UserNotProvisionedError);
  assert.deepEqual(f.writes, []);
});

function routeDeps(authUser: unknown, service: AuthService) {
  return {
    zod, "@/lib/auth/account-access": access, "@/lib/validations/auth": authValidation, "@/lib/config-messages": { zodIssueMessage: (e: { issues: Array<{ message: string }> }, f: string) => e.issues[0]?.message ?? f },
    "@/lib/auth/normalize-email": normalize,
    "@/services/supabase/server": { createClient: async () => ({ auth: {
      signInWithPassword: async () => ({ data: { user: authUser }, error: null }),
      getUser: async () => ({ data: { user: authUser } }),
      signOut: async () => ({ error: null }),
    } }) },
    "@/domains/onboarding/onboarding.service": { resolveOnboardingLoginPath: async (_user: unknown, path: string) => path },
    "@/domains/auth/login-rate-limit.service": { startLoginAttempt: async () => ({ allowed: true, attempt: null }), settleLoginAttempt: async () => {} },
    "@/domains/growth/contact.service": { contactSourceFromHeaders: () => "test-source" },
    "@/domains/auth/auth.service": service,
    "@/domains/user/user.service": { ...userService, getUserPermissions: async () => [] },
    "@/lib/demo/constants": constants, "@/lib/demo/persona-cookie": {},
    "@/domains/demo/demo-auth.service": {},
    "@/domains/demo/demo-session.service": { ensureDemoSessionForLogin: async () => assert.fail("non-demo session must not be created") },
    "@/domains/demo/demo-pool.service": { DemoPoolUnavailableError: class extends Error {}, maintainDemoPool: async () => [] },
    "@/domains/saas/saas-session": { getSessionSaasAccess: async () => null },
  };
}

for (const file of ["login", "sync"] as const) {
  test(`route ${file} : métadonnées falsifiées et accountType company refusés sans provisionnement`, async () => {
    const f = authFixture();
    const authUser = { id: "auth", email: "pirate@example.test", email_confirmed_at: "2026-10-28", user_metadata: FORGED_METADATA };
    const { POST } = load<{ POST: (r: Request) => Promise<Response> }>(`src/app/api/auth/${file}/route.ts`, routeDeps(authUser, f.service));
    const bodies = file === "login"
      ? [{ email: "pirate@example.test", password: "local-test-only" }, { email: "pirate@example.test", password: "local-test-only", accountType: "company" }]
      : [{}, { accountType: "company" }];
    for (const body of bodies) {
      const response = await POST(new Request("http://local", { method: "POST", body: JSON.stringify(body) }));
      // Sync n'accepte aucun champ (400) ; sinon le compte non provisionné est refusé (403).
      const expected = file === "sync" && "accountType" in body ? 400 : 403;
      assert.equal(response.status, expected, JSON.stringify(body));
    }
    assert.deepEqual(f.writes, []);
  });
}

for (const role of ["CLIENT", "DRIVER", "COMPANY_ADMIN"] as const) {
  test(`compte ${role} déjà provisionné : inchangé, métadonnées ignorées`, async () => {
    const existing = user(role);
    const f = authFixture(existing);
    const result = await f.service.syncUserFromSupabase({ ...FORGED_INPUT, email: existing.email } as Parameters<AuthService["syncUserFromSupabase"]>[0]);
    assert.equal(result.companyId, "a");
    assert.equal(result.role.systemRole, role);
    assert.deepEqual(f.writes, []);
    assert.equal(f.updates.length, 1);
    assert.deepEqual(Object.keys(f.updates[0]!.data), ["lastLoginAt"]);
    assert.equal(f.links(), role === "CLIENT" ? 1 : 0);
  });
}

test("garde serveur : session confirmée sans profil et métadonnées falsifiées -> aucun accès ni provisionnement", async () => {
  const f = authFixture();
  const server = load<typeof import("../src/lib/api/server-auth")>("src/lib/api/server-auth.ts", {
    react: { cache: (fn: unknown) => fn },
    "next/headers": { headers: async () => ({ get: () => null }) },
    "@/lib/auth/auth-headers": { TUTELLIV_AUTH_ID_HEADER: "x-test-auth" },
    "@/services/supabase/server": { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: "auth", email: "pirate@example.test", email_confirmed_at: "2026-10-28", user_metadata: FORGED_METADATA } } }) } }) },
    "@/domains/user/user.service": { getUserByAuthId: async () => null },
    "@/domains/auth/auth.service": f.service,
    "@/lib/permissions/rbac": {}, "@/domains/demo/demo-auth.service": {},
    "@/lib/auth/account-access": access, "@/lib/demo/constants": constants,
  });
  assert.equal(await server.getServerAuth(), null);
  assert.deepEqual(f.writes, []);
});

test("rattachement par e-mail : authId lié, prénom et nom de la base conservés (métadonnées ignorées)", async () => {
  const invited = user("DRIVER");
  const f = authFixture(null, invited);
  await f.service.syncUserFromSupabase({ ...FORGED_INPUT, email: invited.email, firstName: "Pirate", lastName: "Renommé" } as Parameters<AuthService["syncUserFromSupabase"]>[0]);
  assert.equal(f.updates.length, 1);
  assert.deepEqual(Object.keys(f.updates[0]!.data).sort(), ["authId", "email", "lastLoginAt"]);
  assert.deepEqual(f.writes, []);
});

test("code mort de l'ancienne auto-inscription supprimé (provisionCompanyAdmin, syncAuth)", () => {
  for (const file of ["src/domains/auth/provision-company-admin.ts", "src/lib/auth/sync-auth.ts"]) {
    assert.equal(existsSync(file), false, file);
  }
});

test("lien de confirmation hors parcours géré : refusé même avec account_type company", async () => {
  const signouts: string[] = [];
  const service = load<typeof import("../src/domains/auth/password-link.service")>("src/domains/auth/password-link.service.ts", {
    "@/lib/auth/email-links": { getPasswordLinkRedirect: () => "https://app.example.com/reset-password" },
    "@/domains/auth/auth.service": { syncUserFromSupabase: async () => assert.fail("no self-signup provisioning") },
    "@/lib/auth/account-access": access,
    "@/domains/user/user.service": { getUserByAuthId: async () => null },
    "@/services/prisma/client": { prisma: {} },
    "@/domains/signup/signup.service": { confirmManagedSignupEmail: async () => assert.fail("not a managed signup") },
    "@/services/supabase/password-link": { createPasswordLinkClient: () => ({ auth: {
      verifyOtp: async () => ({ data: { user: { id: "auth", email: "pirate@example.test", email_confirmed_at: "2026-10-28", user_metadata: FORGED_METADATA }, session: {} }, error: null }),
      signOut: async ({ scope }: { scope: string }) => { signouts.push(scope); return { error: null }; },
    } }) },
  });
  await assert.rejects(service.finishPasswordLink({ tokenHash: "test-token-not-a-real-secret", type: "signup" }), /AUTH_LINK_INVALID/);
  assert.deepEqual(signouts, ["local"]);
});
