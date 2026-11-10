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
import * as authService from "../src/domains/auth/auth.service";
import * as userService from "../src/domains/user/user.service";
import * as authValidation from "../src/lib/validations/auth";
import * as normalize from "../src/lib/auth/normalize-email";
import { prisma } from "../src/services/prisma/client";

// Real TS modules, isolated instances, external I/O replaced explicitly.
// React cache is identity here: each call represents a new HTTP request.
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
function user(role: SystemRole = "ADMIN"): UserWithRole {
  return {
    id: "u", authId: "auth", email: "local@example.com", firstName: "Test", lastName: "Local",
    status: "ACTIVE", companyId: "a", roleId: "r", createdAt: new Date(), updatedAt: new Date(),
    settings: {},
    role: { id: "r", name: "Role", slug: "role", systemRole: role, isSystem: true, permissions: [{ slug: "users:read" }, { slug: "orders:read" }] },
    company: { id: "a", status: "ACTIVE" },
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
  for (const role of ["SUPER_ADMIN", "ADMIN", "BAKER", "MERCHANT", "DRIVER"] as SystemRole[]) {
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
  let headerId: string | null = "auth";
  let readError = false;
  let syncError: Error | null = null;
  let reads = 0;
  const getUserByAuthId = async () => { reads++; if (readError) throw new Error("DATABASE_UNAVAILABLE"); return current ? structuredClone(current) : null; };
  const deps = {
    "@/lib/auth/account-access": access,
    "@/domains/user/user.service": { getUserByAuthId, extractPermissionSlugs: userService.extractPermissionSlugs },
    "@/services/supabase/server": { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: "auth", email: "local@example.com", email_confirmed_at: "2026-09-28", user_metadata: {} } } }) } }) },
  };
  function instance() {
    const server = load<typeof import("../src/lib/api/server-auth")>("src/lib/api/server-auth.ts", {
      ...deps,
      react: { cache: (fn: unknown) => fn },
      "next/headers": { headers: async () => ({ get: () => headerId }) },
      "@/lib/auth/auth-headers": { ANNONA_AUTH_ID_HEADER: "x-test-auth" },
      "@/domains/auth/auth.service": { ...authService, syncUserFromSupabase: async () => { if (syncError) throw syncError; return current; } },
      "@/lib/permissions/rbac": rbac,
    });
    const guard = load<typeof import("../src/lib/api/auth-guard")>("src/lib/api/auth-guard.ts", { "./server-auth": server, "@/lib/permissions/rbac": rbac });
    return { server, guard };
  }
  return { instance, deps, get current() { return current!; }, set current(u: UserWithRole | null) { current = u; }, set headerId(id: string | null) { headerId = id; }, set readError(v: boolean) { readError = v; }, set syncError(e: Error) { syncError = e; }, reads: () => reads };
}
function status(result: Awaited<ReturnType<typeof import("../src/lib/api/auth-guard").requireAuth>>) {
  return "error" in result ? result.error.status : 200;
}

test("deux instances : retrait de permission effectif à la requête suivante, sans attendre", async () => {
  const e = environment(); const a = e.instance(); const b = e.instance();
  for (const i of [a, b]) assert.equal(status(await i.guard.requireStaffRole("users:read")), 200);
  e.current!.role.permissions = [{ slug: "orders:read" }] as UserWithRole["role"]["permissions"];
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
    // Lot 1, demande 9 : le compte est relu en une requête SQL (`getUserByAuthId`) ; les autres lectures brutes inchangées.
    t.mock.method(prisma, "$queryRaw", async (strings: TemplateStringsArray) => {
      if (!strings.join("").includes("to_jsonb(u.*)")) return [{ id: "r", system_role: "BAKER" }];
      if (byEmail) return [];
      const { role, company, ...rest } = u as typeof u & { company?: unknown };
      const { permissions, ...roleRow } = role;
      return [{ u: rest, c: company ?? null, r: roleRow, p: permissions }];
    });
    replace(t, prisma.rolePermission, "findMany", async () => []);
    t.mock.method(prisma, "$transaction", async () => assert.fail("no linking allowed"));
    await assert.rejects(authService.syncUserFromSupabase({ authId: "auth", email: u.email }), access.AccountUnavailableError);
  });
}

test("routes connexion et synchronisation : compte actif accepté, suspension refusée 403", async () => {
  for (const file of ["login", "sync"]) {
    let current = user("ADMIN");
    const authUser = { id: "auth", email: current.email, email_confirmed_at: "2026-09-28", user_metadata: {} };
    const post = load<{ POST: (r: Request) => Promise<Response> }>(`src/app/api/auth/${file}/route.ts`, {
      zod: await import("zod"), "@/lib/auth/account-access": access, "@/lib/validations/auth": authValidation, "@/lib/config-messages": { zodIssueMessage: (e: { issues: Array<{ message: string }> }, f: string) => e.issues[0]?.message ?? f },
      "@/lib/auth/normalize-email": normalize,
      "@/services/supabase/server": { createClient: async () => ({ auth: {
        signInWithPassword: async () => ({ data: { user: authUser }, error: null }),
        getUser: async () => ({ data: { user: authUser } }),
      } }) },
      "@/services/supabase/admin": { createAdminClient: () => assert.fail("unexpected admin call") },
      "@/domains/auth/login-rate-limit.service": { startLoginAttempt: async () => ({ allowed: true, attempt: null }), settleLoginAttempt: async () => {} },
      "@/lib/security/request-source": { requestSourceFromHeaders: () => "test-source" },
      "@/domains/auth/auth.service": { ...authService, syncUserFromSupabase: async () => structuredClone(current) },
      "@/domains/user/user.service": { ...userService, getUserPermissions: async () => userService.extractPermissionSlugs(current) },
    }).POST;
    // /api/auth/sync n'accepte aucun champ (SEC-4) ; /api/auth/login attend les identifiants.
    const request = () => new Request("http://local", { method: "POST", body: JSON.stringify(file === "sync" ? {} : { email: current.email, password: "local-test-only" }) });
    assert.equal((await post(request())).status, 200);
    current.status = "SUSPENDED";
    assert.equal((await post(request())).status, 403);
    current = user("ADMIN"); current.company!.status = "INACTIVE";
    assert.equal((await post(request())).status, 403);
  }
});

