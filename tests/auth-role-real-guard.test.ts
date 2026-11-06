import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { runInThisContext } from "node:vm";
import ts from "typescript";
import { NextRequest } from "next/server";
import { ROLE_PERMISSIONS } from "../prisma/reference-data";
import { demoRetentionSettings } from "../src/lib/demo/retention";
import { demoSessionCompanySlug } from "../src/domains/demo/demo-session.service";
import { buildMiniAdminSettings } from "../src/lib/permissions/mini-admin";
import { demoPersonaAuthId } from "../src/lib/demo/constants";

// AUTH-ROLE : le vrai chemin de la garde (middleware → updateSession → resolveServerAuthForAuthId →
// getUserByAuthId → isAccountActive → persona et session de démo → evaluatePageAccess) est exécuté.
// Seuls Prisma, le client Supabase (@supabase/ssr) et next/headers sont simulés.

const nodeRequire = createRequire(resolve("package.json"));

type Row = Record<string, unknown>;
interface Db {
  usersByAuthId: Record<string, Row>;
  personaUsers?: Row[];
  companiesBySlug?: Record<string, Row>;
}

function role(systemRole: keyof typeof ROLE_PERMISSIONS) {
  return {
    id: `role-${systemRole}`,
    systemRole,
    name: systemRole,
    permissions: ROLE_PERMISSIONS[systemRole].map((slug) => ({ permission: { slug } })),
  };
}

function company(id: string, extra: Row = {}): Row {
  return { id, status: "ACTIVE", isDemo: false, slug: id, settings: {}, createdAt: new Date(), ...extra };
}

function user(authId: string, systemRole: keyof typeof ROLE_PERMISSIONS, extra: Row = {}): Row {
  const c = (extra.company as Row | undefined) ?? company("c1");
  return {
    id: `u-${authId}`, authId, email: `${authId}@example.test`, status: "ACTIVE",
    companyId: c.id, company: c, settings: {}, role: role(systemRole), ...extra,
  };
}

function fakePrisma(db: Db) {
  return {
    user: {
      findUnique: async ({ where }: { where: { authId?: string } }) => structuredClone(db.usersByAuthId[where.authId ?? ""] ?? null),
      findFirst: async ({ where }: { where: { companyId: string; authId?: string } }) =>
        structuredClone(db.personaUsers?.find((u) => u.companyId === where.companyId && (!where.authId || u.authId === where.authId)) ?? null),
    },
    company: {
      findUnique: async ({ where }: { where: { slug: string } }) => structuredClone(db.companiesBySlug?.[where.slug] ?? null),
    },
    demoPoolEnvironment: { findUnique: async () => null },
  };
}

/** Charge les vrais modules de src/ (CommonJS transpilé) ; seules les dépendances listées sont simulées. */
function loadGuard(db: Db) {
  let currentRequest: NextRequest | null = null;
  const mocks: Record<string, unknown> = {
    "server-only": {},
    react: { cache: <T>(fn: T) => fn },
    "next/headers": {
      headers: async () => currentRequest!.headers,
      cookies: async () => currentRequest!.cookies,
    },
    "@supabase/ssr": {
      createServerClient: (_url: string, _key: string, options: { cookies: { getAll: () => Array<{ name: string; value: string }> } }) => {
        const token = options.cookies.getAll().find((c) => c.name === "sb-test-auth-token")?.value ?? "";
        const sub = token.startsWith("jwt:") ? token.slice(4) : null;
        return {
          auth: {
            getClaims: async () => ({ data: sub ? { claims: { sub, exp: Math.floor(Date.now() / 1000) + 3600 } } : null }),
            getUser: async () => ({ data: { user: null } }),
          },
        };
      },
    },
    "@/services/prisma/client": { prisma: fakePrisma(db) },
    "@/services/supabase/server": { createClient: async () => { throw new Error("NOT_EXPECTED"); } },
    "@/services/supabase/admin": { createAdminClient: () => { throw new Error("NOT_EXPECTED"); } },
    "@/domains/auth/auth.service": {
      syncUserFromSupabase: async () => { throw new Error("NOT_EXPECTED"); },
      UserNotProvisionedError: class extends Error {},
    },
    "@/domains/client-portal/client-data.service": { linkPortalDataToClient: async () => undefined },
    "@/domains/saas/saas.service": { releaseSaasSeat: async () => undefined, reserveSaasSeat: async () => undefined },
    "@/domains/demo/demo-scenario.service": { resetDemoScenario: async () => undefined },
    "@/lib/auth/email-links": { getPasswordLinkRedirect: () => "/" },
    "@/lib/security/origin-check": { isCrossOriginMutation: () => false, isOriginCheckExempt: () => false },
  };
  const cache = new Map<string, { exports: Record<string, unknown> }>();
  const loaded: string[] = [];

  function resolveFile(id: string, from: string): string | null {
    const base = id.startsWith("@/") ? resolve("src", id.slice(2)) : id.startsWith(".") ? resolve(dirname(from), id) : null;
    if (!base) return null;
    for (const candidate of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) if (existsSync(candidate)) return candidate;
    throw new Error(`Module introuvable : ${id}`);
  }

  function requireFrom(from: string) {
    return (id: string) => {
      if (id in mocks) return mocks[id];
      const file = resolveFile(id, from);
      if (!file) return nodeRequire(id);
      const hit = cache.get(file);
      if (hit) return hit.exports;
      const module = { exports: {} as Record<string, unknown> };
      cache.set(file, module);
      loaded.push(file.slice(resolve("src").length + 1));
      const source = ts.transpileModule(readFileSync(file, "utf8"), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
      }).outputText;
      const wrapper = runInThisContext(`(function (exports, require, module) {${source}\n})`, { filename: file });
      wrapper(module.exports, requireFrom(file), module);
      return module.exports;
    };
  }

  const { middleware } = requireFrom(resolve("src/middleware.ts"))("./middleware") as {
    middleware: (request: NextRequest) => Promise<Response>;
  };
  return {
    loaded,
    async call(path: string, cookies: Record<string, string> = {}, headers: Record<string, string> = {}) {
      const cookie = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ");
      const request = new NextRequest(`http://localhost:3110${path}`, { headers: { ...headers, ...(cookie ? { cookie } : {}) } });
      currentRequest = request;
      const response = await middleware(request);
      return {
        status: response.status,
        location: response.headers.get("location"),
        forwardedAuthId: response.headers.get("x-middleware-request-x-annona-auth-id"),
        overrides: response.headers.get("x-middleware-override-headers") ?? "",
      };
    },
  };
}

const session = (authId: string) => ({ "sb-test-auth-token": `jwt:${authId}` });

test("AUTH-ROLE garde réelle : les vrais modules sont exécutés, seuls Prisma, Supabase et next/headers sont simulés", async () => {
  const guard = loadGuard({ usersByAuthId: { admin: user("admin", "COMPANY_ADMIN") } });
  const allowed = await guard.call("/dashboard", session("admin"));
  assert.equal(allowed.status, 200);
  for (const file of [
    "middleware.ts", "services/supabase/middleware.ts", "lib/api/server-auth.ts", "domains/user/user.service.ts",
    "domains/demo/demo-auth.service.ts", "domains/demo/demo-session.service.ts", "lib/auth/account-access.ts",
    "lib/permissions/page-access.ts",
  ]) {
    assert.ok(guard.loaded.includes(file), file);
  }
});

test("AUTH-ROLE garde réelle : compte désactivé et entreprise suspendue renvoyés à la connexion", async () => {
  const guard = loadGuard({
    usersByAuthId: {
      off: user("off", "COMPANY_ADMIN", { status: "INACTIVE" }),
      suspended: user("suspended", "DISPATCHER", { company: company("c2", { status: "SUSPENDED" }) }),
      client: user("client", "CLIENT"),
    },
  });
  for (const [authId, path] of [["off", "/dashboard"], ["suspended", "/dispatch"]] as const) {
    const response = await guard.call(path, session(authId));
    assert.equal(response.status, 307, authId);
    assert.equal(response.location, `http://localhost:3110/login?redirect=${encodeURIComponent(path)}`, authId);
    // … et la page de connexion reste affichée (pas de boucle).
    assert.equal((await guard.call("/login", session(authId))).status, 200, authId);
  }
  const wrongRole = await guard.call("/dashboard", session("client"));
  assert.equal(wrongRole.location, "http://localhost:3110/portal");
});

test("AUTH-ROLE garde réelle : permissions du mini-admin filtrées par ses modules en base", async () => {
  const guard = loadGuard({
    usersByAuthId: { mini: user("mini", "MINI_ADMIN", { settings: buildMiniAdminSettings("Support", ["support"]) }) },
  });
  assert.equal((await guard.call("/support", session("mini"))).status, 200);
  for (const path of ["/dashboard", "/users", "/dispatch/map"]) {
    const expected = path === "/dashboard" ? "http://localhost:3110/support" : "http://localhost:3110/support?acces-refuse=1";
    assert.equal((await guard.call(path, session("mini"))).location, expected, path);
  }
});

test("AUTH-ROLE garde réelle : persona de démo active, puis session de démo expirée", async () => {
  const sessionId = "a".repeat(64);
  const slug = demoSessionCompanySlug(sessionId);
  const template = company("demo-template", { isDemo: true });
  const live = new Date();
  const sessionCompany = (createdAt: Date) =>
    company("demo-session", { isDemo: true, slug, createdAt, settings: { demoSession: true, demoRetention: demoRetentionSettings(createdAt) } });
  const base = user("demo", "COMPANY_ADMIN", { email: "demo@annona.fr", company: template });
  const sessionCompanyRow = sessionCompany(live);
  const clientPersona = user(demoPersonaAuthId("client", "demo-session"), "CLIENT", { company: sessionCompanyRow });
  const cookies = { ...session("demo"), "annona-demo-session": sessionId, "annona-demo-persona": "client" };

  const active = loadGuard({ usersByAuthId: { demo: base }, personaUsers: [clientPersona], companiesBySlug: { [slug]: sessionCompanyRow } });
  assert.equal((await active.call("/portal/orders", cookies)).status, 200);
  assert.equal((await active.call("/dashboard", cookies)).location, "http://localhost:3110/portal");

  // Session expirée : getDemoSessionCompanyId lève AccountUnavailableError → aucun accès, connexion.
  const expired = loadGuard({
    usersByAuthId: { demo: base },
    personaUsers: [clientPersona],
    companiesBySlug: { [slug]: sessionCompany(new Date(Date.now() - 9 * 60 * 60 * 1000)) },
  });
  const denied = await expired.call("/portal/orders", cookies);
  assert.equal(denied.status, 307);
  assert.equal(denied.location, "http://localhost:3110/login/client?redirect=%2Fportal%2Forders");
  assert.equal((await expired.call("/login", cookies)).status, 200);
});

test("AUTH-ROLE garde réelle : l'en-tête interne usurpé est effacé et remplacé par l'identité vérifiée", async () => {
  const guard = loadGuard({ usersByAuthId: { admin: user("admin", "COMPANY_ADMIN"), client: user("client", "CLIENT") } });
  const spoof = { "x-annona-auth-id": "admin" };
  // Anonyme : l'en-tête transmis aux API et pages est supprimé.
  // L'en-tête témoin prouve que la liste des en-têtes transmis est bien réécrite (et pas laissée intacte).
  const anonymousApi = await guard.call("/api/orders", {}, { ...spoof, "x-probe": "1" });
  assert.equal(anonymousApi.forwardedAuthId, null);
  const forwarded = anonymousApi.overrides.split(",");
  assert.ok(forwarded.includes("x-probe"), anonymousApi.overrides);
  assert.equal(forwarded.includes("x-annona-auth-id"), false);
  // Client connecté : l'en-tête transmis est son authId vérifié, jamais la valeur usurpée.
  const clientApi = await guard.call("/api/orders", session("client"), spoof);
  assert.equal(clientApi.forwardedAuthId, "client");
  const clientPage = await guard.call("/dashboard", session("client"), spoof);
  assert.equal(clientPage.location, "http://localhost:3110/portal");
  // Anonyme qui usurpe l'en-tête sur une page : connexion.
  assert.equal((await guard.call("/dashboard", {}, spoof)).location, "http://localhost:3110/login?redirect=%2Fdashboard");
});
