import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server";
import type { UserWithRole, UserStatus, CompanyStatus, SystemRole } from "../src/types";
import * as access from "../src/lib/auth/account-access";
import * as rbac from "../src/lib/permissions/rbac";
import * as constants from "../src/lib/demo/constants";
import * as authService from "../src/domains/auth/auth.service";
import * as userService from "../src/domains/user/user.service";
import * as authValidation from "../src/lib/validations/auth";
import * as normalize from "../src/lib/auth/normalize-email";
import { prisma } from "../src/services/prisma/client";

// Real TS modules, isolated instances, external I/O replaced explicitly.
// React cache is identity here: each call represents a new HTTP request.
function load<T>(file: string, dependencies: Record<string, unknown>): T {
  const module = { exports: {} };
  const deps = { "server-only": {}, "next/server": { NextResponse }, ...dependencies };
  const source = ts.transpileModule(readFileSync(resolve(file), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(source, { Error, console, exports: module.exports, module, require: (id: string) => {
    assert.ok(id in deps, `Unexpected dependency ${id}`);
    return deps[id as keyof typeof deps];
  } });
  return module.exports as T;
}
function user(role: SystemRole = "MINI_ADMIN"): UserWithRole {
  return {
    id: "u", authId: "auth", email: "local@example.com", firstName: "Test", lastName: "Local",
    status: "ACTIVE", companyId: "a", roleId: "r", createdAt: new Date(), updatedAt: new Date(),
    settings: { miniAdmin: { modules: ["accounts"] } },
    role: { id: "r", name: "Role", slug: "role", systemRole: role, isSystem: true, permissions: [{ slug: "users:read" }, { slug: "orders:read" }] },
    company: { id: "a", status: "ACTIVE", isDemo: false },
  } as UserWithRole;
}
test("statuts : seuls compte ACTIVE et entreprise ACTIVE/TRIAL sont admis", () => {
  for (const status of ["ACTIVE", "INACTIVE", "SUSPENDED", "PENDING_VERIFICATION"] as UserStatus[]) {
    for (const companyStatus of ["ACTIVE", "INACTIVE", "SUSPENDED", "TRIAL"] as CompanyStatus[]) {
      const u = user(); u.status = status; u.company!.status = companyStatus;
      assert.equal(access.isAccountActive(u), status === "ACTIVE" && ["ACTIVE", "TRIAL"].includes(companyStatus));
    }
  }
});
test("entreprise manquante ou incohérente : refus, sauf super-admin sans entreprise", () => {
  for (const role of ["SUPER_ADMIN", "COMPANY_ADMIN", "MINI_ADMIN", "CLIENT", "DRIVER", "DISPATCHER"] as SystemRole[]) {
    const u = user(role); u.company = null;
    assert.equal(access.isAccountActive(u), false);
    u.companyId = null;
    assert.equal(access.isAccountActive(u), role === "SUPER_ADMIN");
    u.status = "SUSPENDED";
    assert.equal(access.isAccountActive(u), false);
  }
  const u = user(); u.company!.id = "b";
  assert.equal(access.isAccountActive(u), false);
});

function environment() {
  let current: UserWithRole | null = user();
  let persona = user("CLIENT");
  let headerId: string | null = "auth";
  let readError = false;
  let syncError: Error | null = null;
  let reads = 0;
  const getUserByAuthId = async () => { reads++; if (readError) throw new Error("DATABASE_UNAVAILABLE"); return current ? structuredClone(current) : null; };
  const deps = {
    "@/lib/auth/account-access": access,
    "@/lib/demo/constants": constants,
    "@/lib/demo/persona-cookie": { getDemoPersonaCookie: async () => "client" },
    "@/domains/demo/demo-session.service": {
      getDemoSessionCompanyId: async () => current?.companyId ?? null,
    },
    "@/domains/demo/demo-users.service": { getDemoPersonaUser: async () => structuredClone(persona) },
    "@/domains/user/user.service": { getUserByAuthId, extractPermissionSlugs: userService.extractPermissionSlugs },
    "@/services/supabase/server": { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: "auth", email: "local@example.com", email_confirmed_at: "2026-09-28", user_metadata: {} } } }) } }) },
  };
  const demo = load<typeof import("../src/domains/demo/demo-auth.service")>("src/domains/demo/demo-auth.service.ts", deps);
  function instance() {
    const server = load<typeof import("../src/lib/api/server-auth")>("src/lib/api/server-auth.ts", {
      ...deps,
      react: { cache: (fn: unknown) => fn },
      "next/headers": { headers: async () => ({ get: () => headerId }) },
      "@/lib/auth/auth-headers": { TUTELLIV_AUTH_ID_HEADER: "x-test-auth" },
      "@/domains/auth/auth.service": { ...authService, syncUserFromSupabase: async () => { if (syncError) throw syncError; return current; } },
      "@/lib/permissions/rbac": rbac,
      "@/domains/demo/demo-auth.service": demo,
    });
    const guard = load<typeof import("../src/lib/api/auth-guard")>("src/lib/api/auth-guard.ts", { "./server-auth": server, "@/lib/permissions/rbac": rbac });
    return { server, guard };
  }
  return { instance, demo, deps, get current() { return current!; }, set current(u: UserWithRole | null) { current = u; }, set persona(u: UserWithRole) { persona = u; }, set headerId(id: string | null) { headerId = id; }, set readError(v: boolean) { readError = v; }, set syncError(e: Error) { syncError = e; }, reads: () => reads };
}
function status(result: Awaited<ReturnType<typeof import("../src/lib/api/auth-guard").requireAuth>>) {
  return "error" in result ? result.error.status : 200;
}

test("deux instances : retrait de module effectif à la requête suivante, sans attendre", async () => {
  const e = environment(); const a = e.instance(); const b = e.instance();
  for (const i of [a, b]) assert.equal(status(await i.guard.requireStaffRole("users:read")), 200);
  e.current!.settings = { miniAdmin: { modules: ["orders"] } };
  for (const i of [a, b]) {
    assert.equal(status(await i.guard.requireStaffRole("users:read")), 403);
    assert.equal(status(await i.guard.requireStaffRole("orders:read")), 200);
  }
  assert.equal(e.reads(), 6);
});
test("suspension, réactivation, suspension entreprise et suppression après session active", async () => {
  const e = environment(); const a = e.instance(); const b = e.instance();
  for (const i of [a, b]) assert.equal(status(await i.guard.requireAuth()), 200);
  e.current!.status = "SUSPENDED";
  for (const i of [a, b]) assert.equal(status(await i.guard.requireAuth()), 401);
  e.current!.status = "ACTIVE";
  assert.equal(status(await a.guard.requireAuth()), 200);
  e.current!.company!.status = "SUSPENDED";
  for (const i of [a, b]) assert.equal(status(await i.guard.requireAuth()), 401);
  e.current = null;
  assert.equal(await a.server.getServerAuth(), null);
});
test("erreur de lecture : aucune ancienne autorisation réutilisée", async () => {
  const e = environment(); const a = e.instance();
  assert.ok(await a.server.getServerAuth()); e.readError = true;
  await assert.rejects(a.server.getServerAuth(), /DATABASE_UNAVAILABLE/);
});
test("fallback Supabase : compte suspendu ou synchronisation refusée sans autorisation", async () => {
  const e = environment(); e.headerId = null; const a = e.instance();
  assert.ok(await a.server.getServerAuth());
  e.current!.status = "SUSPENDED";
  assert.equal(await a.server.getServerAuth(), null);
  e.current = null; e.syncError = new access.AccountUnavailableError();
  assert.equal(await a.server.getServerAuth(), null);
});
test("démo : contrôler le compte de connexion ET la persona", async () => {
  const e = environment(); const a = e.instance();
  e.current!.email = constants.DEMO_LOGIN_EMAIL; e.current!.company!.isDemo = true;
  assert.ok(await a.server.getServerAuth());
  const persona = user("CLIENT"); persona.status = "SUSPENDED"; e.persona = persona;
  assert.equal(await a.server.getServerAuth(), null);
  e.persona = user("CLIENT"); e.current!.status = "SUSPENDED";
  assert.equal(await a.server.getServerAuth(), null);
  assert.equal(await e.demo.getDemoBaseAuthUser("auth"), null);
});

function replace(t: TestContext, obj: object, key: string, fn: unknown) {
  const original = Reflect.get(obj, key); Reflect.set(obj, key, fn);
  t.after(() => { Reflect.set(obj, key, original); });
}
for (const byEmail of [false, true]) {
  test(`synchronisation réelle : compte suspendu refusé avant toute écriture (${byEmail ? "email" : "authId"})`, async (t) => {
    const u = user(); u.status = "SUSPENDED";
    replace(t, prisma.user, "findUnique", async () => byEmail ? null : { ...u, role: { ...u.role, permissions: u.role.permissions.map((permission) => ({ permission })) } });
    replace(t, prisma.user, "findFirst", async () => u);
    replace(t, prisma.user, "update", async () => assert.fail("no update allowed"));
    t.mock.method(prisma, "$queryRaw", async () => [{ id: "r", system_role: "MINI_ADMIN" }]);
    replace(t, prisma.rolePermission, "findMany", async () => []);
    t.mock.method(prisma, "$transaction", async () => assert.fail("no linking allowed"));
    await assert.rejects(authService.syncUserFromSupabase({ authId: "auth", email: u.email, firstName: "Test", lastName: "Local" }), access.AccountUnavailableError);
  });
}

test("routes connexion et synchronisation : compte actif accepté, suspension refusée 403", async () => {
  for (const file of ["login", "sync"]) {
    let current = user("COMPANY_ADMIN");
    const authUser = { id: "auth", email: current.email, email_confirmed_at: "2026-09-28", user_metadata: {} };
    const post = load<{ POST: (r: Request) => Promise<Response> }>(`src/app/api/auth/${file}/route.ts`, {
      "@/lib/auth/account-access": access, "@/lib/validations/auth": authValidation,
      "@/lib/auth/normalize-email": normalize,
      "@/services/supabase/server": { createClient: async () => ({ auth: {
        signInWithPassword: async () => ({ data: { user: authUser }, error: null }),
        getUser: async () => ({ data: { user: authUser } }),
      } }) },
      "@/services/supabase/admin": { createAdminClient: () => assert.fail("unexpected admin call") },
      "@/domains/onboarding/onboarding.service": { resolveOnboardingLoginPath: async (_user: unknown, path: string) => path },
      "@/domains/auth/auth.service": { ...authService, syncUserFromSupabase: async () => structuredClone(current) },
      "@/domains/user/user.service": { ...userService, getUserPermissions: async () => userService.extractPermissionSlugs(current) },
      "@/lib/demo/constants": constants, "@/lib/demo/persona-cookie": {},
      "@/domains/demo/demo-auth.service": {}, "@/domains/demo/demo-scenario.service": {}, "@/domains/demo/demo-provision.service": {},
      "@/domains/demo/demo-session.service": {
        ensureDemoSessionForLogin: async () => assert.fail("non-demo session must not be created"),
      },
      "@/domains/demo/demo-pool.service": {
        DemoPoolUnavailableError: class extends Error {},
        maintainDemoPool: async () => [],
      },
      "@/domains/saas/saas-session": { getSessionSaasAccess: async () => null },
    }).POST;
    const request = () => new Request("http://local", { method: "POST", body: JSON.stringify({ email: current.email, password: "local-test-only" }) });
    assert.equal((await post(request())).status, 200);
    current.status = "SUSPENDED";
    assert.equal((await post(request())).status, 403);
    current = user("COMPANY_ADMIN"); current.company!.status = "INACTIVE";
    assert.equal((await post(request())).status, 403);
  }
});

test("routes démo : persona suspendue et reset avec admin suspendu refusés sans mutation", async () => {
  for (const file of ["persona", "reset"]) {
    const persona = user(); persona.status = "SUSPENDED";
    const { POST } = load<{ POST: (r: Request) => Promise<Response> }>(`src/app/api/demo/${file}/route.ts`, {
      zod: await import("zod"), "@/lib/auth/account-access": access,
      "@/domains/demo/demo-auth.service": { getDemoBaseAuthUser: async () => user() },
      "@/domains/demo/demo-users.service": { getDemoPersonaUser: async () => persona },
      "@/domains/demo/demo-scenario.service": { resetDemoScenario: async () => assert.fail("no reset allowed") },
      "@/domains/demo/demo-session.service": { getDemoSessionCompanyId: async () => "a" },
      "@/lib/demo/constants": constants,
      "@/lib/demo/persona-cookie": { setDemoPersonaCookie: async () => assert.fail("no cookie change allowed") },
      "@/domains/user/user.service": userService,
      "@/domains/saas/saas-session": { getSessionSaasAccess: async () => null },
    });
    assert.equal((await POST(new Request("http://local", { method: "POST", body: JSON.stringify({ persona: "client" }) }))).status, 403);
  }
});
