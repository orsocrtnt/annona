import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { runInThisContext } from "node:vm";
import ts from "typescript";
import { NextRequest } from "next/server";
import { ROLE_PERMISSIONS } from "../prisma/reference-data";

// AUTH-ROLE : le vrai chemin de la garde (middleware → updateSession → resolveServerAuthForAuthId →
// getUserByAuthId → isAccountActive → evaluatePageAccess) est exécuté.
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
  return { id, status: "ACTIVE", slug: id, settings: {}, createdAt: new Date(), ...extra };
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
  const guard = loadGuard({ usersByAuthId: { admin: user("admin", "ADMIN") } });
  const allowed = await guard.call("/dashboard", session("admin"));
  assert.equal(allowed.status, 200);
  for (const file of [
    "middleware.ts", "services/supabase/middleware.ts", "lib/api/server-auth.ts", "domains/user/user.service.ts",
    "lib/auth/account-access.ts",
    "lib/permissions/page-access.ts",
  ]) {
    assert.ok(guard.loaded.includes(file), file);
  }
});

test("AUTH-ROLE garde réelle : compte désactivé et entreprise suspendue renvoyés à la connexion", async () => {
  const guard = loadGuard({
    usersByAuthId: {
      off: user("off", "ADMIN", { status: "INACTIVE" }),
      suspended: user("suspended", "BAKER", { company: company("c2", { status: "SUSPENDED" }) }),
      client: user("client", "MERCHANT"),
    },
  });
  for (const [authId, path] of [["off", "/dashboard"], ["suspended", "/bakery"]] as const) {
    const response = await guard.call(path, session(authId));
    assert.equal(response.status, 307, authId);
    assert.equal(response.location, `http://localhost:3110/login?redirect=${encodeURIComponent(path)}`, authId);
    // … et la page de connexion reste affichée (pas de boucle).
    assert.equal((await guard.call("/login", session(authId))).status, 200, authId);
  }
  const wrongRole = await guard.call("/dashboard", session("client"));
  assert.equal(wrongRole.location, "http://localhost:3110/portal");
});

test("AUTH-ROLE garde réelle : chaque rôle relu en base est envoyé vers son espace", async () => {
  const guard = loadGuard({
    usersByAuthId: {
      admin: user("admin", "ADMIN"),
      baker: user("baker", "BAKER"),
      driver: user("driver", "DRIVER"),
      client: user("client", "MERCHANT"),
    },
  });
  for (const [authId, home] of [["admin", "/dashboard"], ["baker", "/bakery"], ["driver", "/driver"], ["client", "/portal"]] as const) {
    assert.equal((await guard.call(home, session(authId))).status, 200, authId);
    assert.equal((await guard.call("/login", session(authId))).location, `http://localhost:3110${home}`, authId);
  }
  // Le boulanger n'ouvre ni le back-office ni le portail.
  assert.equal((await guard.call("/users", session("baker"))).location, "http://localhost:3110/bakery?acces-refuse=1");
  assert.equal((await guard.call("/portal", session("baker"))).location, "http://localhost:3110/bakery?acces-refuse=1");
});

test("AUTH-ROLE garde réelle : l'en-tête interne usurpé est effacé et remplacé par l'identité vérifiée", async () => {
  const guard = loadGuard({ usersByAuthId: { admin: user("admin", "ADMIN"), client: user("client", "MERCHANT") } });
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
