import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import * as access from "../src/lib/auth/account-access";
import * as links from "../src/lib/auth/email-links";
import * as validation from "../src/lib/validations/auth";
import * as mini from "../src/lib/permissions/mini-admin";
import * as demo from "../src/lib/demo/constants";
import * as limits from "../src/lib/query/list-limits";
import type { UserWithRole } from "../src/types";

function load<T>(file: string, dependencies: Record<string, unknown>): T {
  const module = { exports: {} };
  const deps = { "next/server": { NextResponse }, ...dependencies };
  const source = ts.transpileModule(readFileSync(resolve(file), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(source, { Error, console, exports: module.exports, module, require: (id: string) => {
    assert.ok(id in deps, `Unexpected dependency ${id}`); return deps[id as keyof typeof deps];
  } });
  return module.exports as T;
}
function configured(t: TestContext) {
  const before = { enabled: process.env.AUTH_EMAIL_LINKS_ENABLED, url: process.env.NEXT_PUBLIC_APP_URL };
  process.env.AUTH_EMAIL_LINKS_ENABLED = "true"; process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
  t.after(() => {
    for (const [key, value] of [["AUTH_EMAIL_LINKS_ENABLED", before.enabled], ["NEXT_PUBLIC_APP_URL", before.url]]) {
      if (value === undefined) delete process.env[key!]; else process.env[key!] = value;
    }
  });
}
function fixture(signup = false) {
  const user = { id: "u", authId: "auth", email: "test@example.com", status: "PENDING_VERIFICATION", companyId: "a", company: { id: "a", status: "ACTIVE" }, role: { systemRole: "CLIENT" } } as UserWithRole;
  let provisions = 0;
  let consumed = false;
  let invalid = false;
  let limited = false;
  let updateFails = false;
  let revokeFails = false;
  let suspensionRace = false;
  let passwordWrites = 0;
  let activations = 0;
  const signouts: string[] = [];
  const sessions: unknown[] = [];
  const recoveries: unknown[] = [];
  const service = load<typeof import("../src/domains/auth/password-link.service")>("src/domains/auth/password-link.service.ts", {
    "@/lib/auth/email-links": links,
    "@/domains/auth/auth.service": { syncUserFromSupabase: async (input: { authId: string; accountType: string }) => { assert.ok(signup); assert.equal(input.authId, "auth"); assert.equal(input.accountType, "company"); provisions++; } },
    "@/lib/auth/account-access": access,
    "@/domains/signup/signup.service": { confirmManagedSignupEmail: async () => ({ resumeToken: "managed-resume-token" }) },
    "@/domains/user/user.service": { getUserByAuthId: async (id: string) => { assert.equal(id, "auth"); return signup ? null : structuredClone(user); } },
    "@/services/prisma/client": { prisma: { user: { updateMany: async ({ where, data }: { where: { id: string; authId: string; status: string; companyId: string; company: { status: { in: string[] } } }; data: { status: string } }) => {
      if (suspensionRace) user.status = "SUSPENDED";
      assert.equal(where.authId, "auth"); assert.equal(where.companyId, "a");
      assert.deepEqual(Array.from(where.company.status.in), ["ACTIVE", "TRIAL"]);
      if (user.status !== where.status) return { count: 0 };
      assert.equal(data.status, "ACTIVE"); user.status = "ACTIVE"; activations++; return { count: 1 };
    } } } },
    "@/services/supabase/password-link": { createPasswordLinkClient: () => ({ auth: {
      verifyOtp: async ({ type, token_hash }: { type: string; token_hash: string }) => {
        assert.ok(["invite", "recovery", "signup"].includes(type)); assert.equal(token_hash, "test-token-not-a-real-secret");
        if (invalid || consumed || limited) return { data: {}, error: { status: limited ? 429 : 403 } };
        consumed = true;
        return { data: { user: { id: "auth", email_confirmed_at: "2026-09-28", email: "test@example.com", user_metadata: { account_type: "company" } }, session: {} }, error: null };
      },
      setSession: async (session: { access_token: string; refresh_token: string }) => {
        sessions.push(session);
        if (invalid || consumed || limited) return { data: {}, error: { status: limited ? 429 : 403 } };
        consumed = true;
        return { data: { user: { id: "auth", email_confirmed_at: "2026-09-28", email: "test@example.com", user_metadata: { account_type: "company" } }, session: {} }, error: null };
      },
      updateUser: async ({ password }: { password: string }) => { assert.equal(password, "TestLocal123!"); passwordWrites++; return { error: updateFails ? new Error("provider") : null }; },
      signOut: async ({ scope }: { scope: string }) => { signouts.push(scope); return { error: revokeFails && scope === "global" ? new Error("provider") : null }; },
      resetPasswordForEmail: async (...args: unknown[]) => { recoveries.push(args); return { error: limited ? { status: 429 } : null }; },
    } }) },
  });
  return { service, user, signouts, sessions, recoveries, provisions: () => provisions, writes: () => passwordWrites, activations: () => activations,
    set invalid(v: boolean) { invalid = v; }, set limited(v: boolean) { limited = v; }, set updateFails(v: boolean) { updateFails = v; }, set revokeFails(v: boolean) { revokeFails = v; }, set suspensionRace(v: boolean) { suspensionRace = v; } };
}
const input = { tokenHash: "test-token-not-a-real-secret", type: "invite" as const, password: "TestLocal123!" };

test("configuration e-mail explicite et URL de retour contrôlée", (t) => {
  configured(t); assert.equal(links.getPasswordLinkRedirect(), "https://app.example.com/reset-password");
  process.env.AUTH_EMAIL_LINKS_ENABLED = "false"; assert.throws(links.getPasswordLinkRedirect, /AUTH_EMAIL_NOT_CONFIGURED/);
  process.env.AUTH_EMAIL_LINKS_ENABLED = "true";
  for (const url of ["invalid", "http://remote.example.com", "javascript:alert(1)"]) {
    process.env.NEXT_PUBLIC_APP_URL = url; assert.throws(links.getPasswordLinkRedirect, /AUTH_EMAIL_NOT_CONFIGURED/);
  }
});
test("invitation : mot de passe choisi, révocation, activation conditionnelle et rejeu refusé", async (t) => {
  configured(t); const f = fixture();
  assert.equal(JSON.stringify(await f.service.finishPasswordLink(input)), "{}");
  assert.equal(f.writes(), 1); assert.equal(f.activations(), 1);
  assert.deepEqual(f.signouts, ["global", "local"]);
  await assert.rejects(f.service.finishPasswordLink(input), /AUTH_LINK_INVALID/);
  assert.equal(f.writes(), 1);
});
test("invitations et récupérations expirées sont refusées sans écriture ni activation", async (t) => {
  configured(t);
  for (const type of ["invite", "recovery"] as const) {
    const f = fixture(); f.invalid = true;
    await assert.rejects(f.service.finishPasswordLink({ ...input, type }), /AUTH_LINK_INVALID/);
    assert.equal(f.writes(), 0); assert.equal(f.activations(), 0);
  }
});
test("limite fournisseur : aucune modification", async (t) => {
  configured(t); const f = fixture(); f.limited = true;
  await assert.rejects(f.service.finishPasswordLink(input), /AUTH_RATE_LIMITED/);
  assert.equal(f.writes(), 0); assert.equal(f.activations(), 0);
});
test("récupération d'un compte actif sans activation ; suspension jamais annulée", async (t) => {
  configured(t); const f = fixture(); f.user.status = "ACTIVE";
  await f.service.finishPasswordLink({ ...input, type: "recovery" });
  assert.equal(f.writes(), 1); assert.equal(f.activations(), 0);
  await assert.rejects(f.service.finishPasswordLink({ ...input, type: "recovery" }), /AUTH_LINK_INVALID/);
  assert.equal(f.writes(), 1); assert.equal(f.activations(), 0);
  for (const kind of ["user", "company"]) {
    const blocked = fixture();
    if (kind === "user") blocked.user.status = "SUSPENDED"; else blocked.user.company!.status = "INACTIVE";
    await assert.rejects(blocked.service.finishPasswordLink({ ...input, type: "recovery" }), /AUTH_LINK_INVALID/);
    assert.equal(blocked.writes(), 0); assert.equal(blocked.activations(), 0);
    assert.deepEqual(blocked.signouts, ["local"]);
  }
});
test("erreur mot de passe, révocation ou suspension concurrente : pas d'activation", async (t) => {
  configured(t);
  for (const failure of ["update", "revoke", "race"]) {
    const f = fixture(); f.updateFails = failure === "update"; f.revokeFails = failure === "revoke"; f.suspensionRace = failure === "race";
    await assert.rejects(f.service.finishPasswordLink(input), /AUTH_PASSWORD_FAILED|AUTH_LINK_INVALID/);
    assert.equal(f.activations(), 0); assert.equal(f.signouts.at(-1), "local");
  }
});
test("récupération : adresse normalisée, destination fixe, limite propagée", async (t) => {
  configured(t); const f = fixture();
  await f.service.requestPasswordRecovery(" TEST@Example.com ");
  assert.equal(JSON.stringify(f.recoveries), JSON.stringify([["test@example.com", { redirectTo: "https://app.example.com/reset-password" }]]));
  f.limited = true; await assert.rejects(f.service.requestPasswordRecovery("test@example.com"), /AUTH_RATE_LIMITED/);
});
test("route du lien : pas de succès ni de secret pour jeton invalide, 429 et mot de passe faible", async (t) => {
  configured(t); const f = fixture(); f.invalid = true;
  const { POST } = load<{ POST: (r: Request) => Promise<Response> }>("src/app/api/auth/password-link/route.ts", {
    zod: await import("zod"), "@/lib/validations/auth": validation,
    "@/domains/auth/password-link.service": f.service,
    "@/domains/signup/signup-cookie": { setSignupResumeCookie: () => undefined },
  });
  const req = (extra = {}) => new Request("http://local", { method: "POST", body: JSON.stringify({ ...input, confirmPassword: input.password, ...extra }) });
  const invalid = await POST(req()); assert.equal(invalid.status, 400); assert.ok(!(await invalid.text()).includes(input.tokenHash));
  f.limited = true; assert.equal((await POST(req())).status, 429);
  assert.equal((await POST(req({ password: "short", confirmPassword: "short" }))).status, 400);
  assert.equal(f.writes(), 0);
});
test("création réelle du service : invitation sans mot de passe, profil en attente, aucun secret retourné", async (t) => {
  configured(t);
  const calls: unknown[] = [];
  const prismaMock: Record<string, unknown> = {
    $queryRaw: async () => [{ id: "role", name: "Driver", slug: "driver", system_role: "DRIVER" }],
    user: { findUnique: async () => null, create: async ({ data }: { data: Record<string, unknown> }) => {
      assert.equal(data.status, "PENDING_VERIFICATION"); assert.equal(data.companyId, "a"); return { id: "u", ...data };
    } },
  };
  prismaMock.$transaction = async (callback: (tx: Record<string, unknown>) => Promise<unknown>) => callback(prismaMock);
  const service = load<typeof import("../src/domains/user/user.service")>("src/domains/user/user.service.ts", {
    "node:crypto": { randomUUID: () => "reservation-test" },
    "@prisma/client": { Prisma }, "@/lib/auth/email-links": links,
    "@/lib/permissions/mini-admin": mini, "@/lib/demo/constants": demo, "@/lib/query/list-limits": limits,
    "@/domains/client-portal/client-data.service": { linkPortalDataToClient: async () => undefined },
    "@/domains/saas/saas.service": {
      reserveSaasSeat: async () => "reservation-test",
      releaseSaasSeat: async () => undefined,
    },
    "@/services/prisma/client": { prisma: prismaMock },
    "@/services/supabase/admin": { createAdminClient: () => ({ auth: { admin: { inviteUserByEmail: async (...args: unknown[]) => { calls.push(args); return { data: { user: { id: "auth" } }, error: null }; } } } }) },
  });
  const result = await service.createUserByAdmin({ firstName: "Test", lastName: "Local", email: "test@example.com", roleSlug: "driver" }, "a", "COMPANY_ADMIN");
  assert.equal(result.invitationSent, true);
  assert.ok(!JSON.stringify(calls).includes("password" + '\"' + ':'));
  assert.ok(!("temporaryPassword" in result));
  assert.ok(!JSON.stringify(calls).includes("email_confirm"));
});
test("ancienne clé de stockage : supprimée, jamais lue ni réécrite", () => {
  const source = ts.transpileModule(readFileSync(resolve("src/lib/storage/pending-credentials.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports: { clearPendingCredentials?: () => void } = {}; const removed: string[] = [];
  runInNewContext(source, { exports, window: {}, localStorage: { removeItem: (key: string) => removed.push(key), getItem: () => assert.fail("no secret read"), setItem: () => assert.fail("no secret write") } });
  exports.clearPendingCredentials!(); assert.deepEqual(removed, ["tutelliv:pending-credentials"]);
});

test("connexion : e-mail non confirmé refusé sans appel administrateur", async () => {
  const { POST } = load<{ POST: (r: Request) => Promise<Response> }>("src/app/api/auth/login/route.ts", {
    "@/lib/auth/account-access": access, "@/lib/validations/auth": validation,
    "@/lib/auth/normalize-email": { normalizeEmail: (s: string) => s.trim().toLowerCase() },
    "@/services/supabase/server": { createClient: async () => ({ auth: { signInWithPassword: async () => ({ data: { user: null }, error: { code: "email_not_confirmed" } }) } }) },
    "@/domains/onboarding/onboarding.service": { resolveOnboardingLoginPath: async (_user: unknown, path: string) => path },
    "@/domains/auth/auth.service": {}, "@/domains/user/user.service": {},
    "@/lib/demo/constants": demo, "@/lib/demo/persona-cookie": {},
    "@/domains/demo/demo-auth.service": {}, "@/domains/demo/demo-scenario.service": {}, "@/domains/demo/demo-provision.service": {},
    "@/domains/demo/demo-session.service": {},
    "@/domains/demo/demo-pool.service": {
      DemoPoolUnavailableError: class extends Error {},
      maintainDemoPool: async () => [],
    },
    "@/domains/saas/saas-session": { getSessionSaasAccess: async () => null },
  });
  assert.equal((await POST(new Request("http://local", { method: "POST", body: JSON.stringify({ email: "test@example.com", password: "TestLocal123!" }) }))).status, 401);
});

test("déconnexion : nettoyer l'état local après succès, signaler un échec fournisseur", async () => {
  for (const failed of [false, true]) {
    const events: string[] = [];
    const { useAuth } = load<{ useAuth: () => { logout: () => Promise<void> } }>("src/hooks/use-auth.ts", {
      react: { useCallback: (fn: unknown) => fn },
      "@/stores/auth.store": { useAuthStore: () => ({ logout: () => events.push("store") }) },
      "@/lib/auth/end-server-session": { endServerSession: () => { events.push("server"); } },
      "@/services/supabase/client": { createClient: () => ({ auth: { signOut: async () => { events.push("signout"); return { error: failed ? new Error("offline") : null }; } } }) },
      "next/navigation": { useRouter: () => ({ push: (url: string) => { assert.equal(url, "/login"); events.push("redirect"); } }) },
      "@tanstack/react-query": { useQueryClient: () => ({ clear: () => events.push("cache") }) },
      "@/lib/storage/pending-credentials": { clearPendingCredentials: () => events.push("legacy") },
      sonner: { toast: { error: () => events.push("error") } },
    });
    await useAuth().logout();
    assert.deepEqual(events, failed ? ["server", "signout", "error"] : ["server", "signout", "store", "legacy", "cache", "redirect"]);
  }
});

// SEC-1 : hors parcours géré, account_type=company (métadonnée modifiable) ne provisionne rien.
test("confirmation d'inscription hors parcours géré : refusée sans provisionnement ni réécriture", async (t) => {
  configured(t); const f = fixture(true);
  await assert.rejects(f.service.finishPasswordLink({ tokenHash: input.tokenHash, type: "signup" }), /AUTH_LINK_INVALID/);
  assert.equal(f.provisions(), 0); assert.equal(f.writes(), 0);
  assert.deepEqual(f.signouts, ["local"]);
});
test("confirmation Supabase par défaut hors parcours géré : session du fragment refusée sans provisionnement", async (t) => {
  configured(t); const f = fixture(true);
  await assert.rejects(f.service.finishPasswordLink({
    accessToken: "access-token-test-not-a-real-secret",
    refreshToken: "refresh-token-test-not-a-real-secret",
    type: "signup",
  }), /AUTH_LINK_INVALID/);
  assert.equal(f.provisions(), 0);
  assert.equal(JSON.stringify(f.sessions), JSON.stringify([{
    access_token: "access-token-test-not-a-real-secret",
    refresh_token: "refresh-token-test-not-a-real-secret",
  }]));
  assert.deepEqual(f.signouts, ["local"]);
});
test("SIGNUP-1 : la session du modèle Supabase reprend le brouillon sans provisionnement anticipé", async (t) => {
  configured(t);
  const calls: unknown[] = [];
  const signouts: string[] = [];
  const service = load<typeof import("../src/domains/auth/password-link.service")>("src/domains/auth/password-link.service.ts", {
    "@/lib/auth/email-links": links,
    "@/domains/auth/auth.service": { syncUserFromSupabase: async () => assert.fail("no legacy provisioning") },
    "@/lib/auth/account-access": access,
    "@/domains/user/user.service": { getUserByAuthId: async () => null },
    "@/services/prisma/client": { prisma: {} },
    "@/domains/signup/signup.service": { confirmManagedSignupEmail: async (input: unknown) => { calls.push(input); return { resumeToken: "resume-token-high-entropy" }; } },
    "@/services/supabase/password-link": { createPasswordLinkClient: () => ({ auth: {
      setSession: async ({ access_token, refresh_token }: { access_token: string; refresh_token: string }) => {
        assert.equal(access_token, "access-token-managed-not-a-real-secret");
        assert.equal(refresh_token, "refresh-token-managed-not-a-real-secret");
        return { data: { user: { id: "auth-managed", email: "managed@example.test", email_confirmed_at: "2026-10-22", user_metadata: { signup_flow: "managed", signup_draft_id: "draft-1", signup_link_token: "link-token-high-entropy" } }, session: {} }, error: null };
      },
      signOut: async ({ scope }: { scope: string }) => { signouts.push(scope); return { error: null }; },
    } }) },
  });
  const result = await service.finishPasswordLink({
    accessToken: "access-token-managed-not-a-real-secret",
    refreshToken: "refresh-token-managed-not-a-real-secret",
    type: "signup",
  });
  assert.equal(result.signupResumeToken, "resume-token-high-entropy");
  assert.equal(JSON.stringify(calls), JSON.stringify([{ draftId: "draft-1", linkToken: "link-token-high-entropy", authUserId: "auth-managed", email: "managed@example.test" }]));
  assert.deepEqual(signouts, ["global", "local"]);
});
test("inscription : demande de confirmation sans profil ni session retournée ; auto-confirmation refusée", async (t) => {
  configured(t); let automaticSession = false; let signouts = 0;
  const service = load<typeof import("../src/domains/auth/provision-company-admin")>("src/domains/auth/provision-company-admin.ts", {
    "@/lib/auth/email-links": links,
    "@/lib/auth/normalize-email": { normalizeEmail: (s: string) => s.trim().toLowerCase() },
    "@/services/supabase/password-link": { createPasswordLinkClient: () => ({ auth: {
      signUp: async (args: { email: string; options: { emailRedirectTo: string; data: { account_type: string } } }) => {
        assert.equal(args.email, "test@example.com"); assert.equal(args.options.data.account_type, "company");
        assert.equal(args.options.emailRedirectTo, "https://app.example.com/reset-password");
        return { data: { session: automaticSession ? {} : null }, error: null };
      },
      signOut: async () => { signouts++; return { error: null }; },
    } }) },
  });
  const args = { email: " TEST@EXAMPLE.COM ", password: "TestLocal123!", firstName: "Test", lastName: "Local" };
  assert.equal(JSON.stringify(await service.provisionCompanyAdmin(args)), '{"verificationRequired":true}');
  automaticSession = true;
  await assert.rejects(service.provisionCompanyAdmin(args), /AUTH_EMAIL_CONFIRMATION_REQUIRED/);
  assert.equal(signouts, 1);
});
