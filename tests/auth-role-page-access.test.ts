import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextRequest, NextResponse } from "next/server";
import type { SystemRole } from "@prisma/client";
import { ROLE_PERMISSIONS } from "../prisma/reference-data";
import { getNavItemsForRole } from "../src/features/navigation/get-nav-items";
import { driverNavItems } from "../src/features/navigation/nav-config";
import {
  buildMiniAdminSettings,
  filterMiniAdminPermissions,
  MINI_ADMIN_MODULE_IDS,
  type MiniAdminModuleId,
} from "../src/lib/permissions/mini-admin";
import * as pageAccess from "../src/lib/permissions/page-access";

const { PROTECTED_PAGE_SPACES, evaluatePageAccess, getPageAccessRule, getRoleHomePath, isProtectedPagePath } =
  pageAccess;

const ROLES: SystemRole[] = ["SUPER_ADMIN", "COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER", "DRIVER", "CLIENT"];

function subject(role: SystemRole, modules: MiniAdminModuleId[] = [...MINI_ADMIN_MODULE_IDS]) {
  const settings = role === "MINI_ADMIN" ? buildMiniAdminSettings("Test", modules) : {};
  const base = [...ROLE_PERMISSIONS[role]];
  const permissions = role === "MINI_ADMIN" ? filterMiniAdminPermissions(base, settings) : base;
  return { role, permissions, settings };
}

/** URL de chaque page.tsx de src/app (groupes et routes parallèles retirés, segments dynamiques remplacés). */
function discoverAllPages(): string[] {
  return readdirSync("src/app", { recursive: true })
    .map((entry) => entry.toString().split("\\").join("/"))
    .filter((entry) => /(^|\/)page\.(tsx|ts|jsx|js|mdx)$/.test(entry) && !entry.startsWith("api/"))
    .map((entry) => {
      const segments = entry.split("/").slice(0, -1)
        .filter((segment) => !/^\(.*\)$/.test(segment) && !segment.startsWith("@"))
        .map((segment) => segment.replace(/^(\(\.{1,3}\))+/, "").replace(/^\[.+\]$/, "x"));
      return `/${segments.join("/")}`;
    });
}

/** Seules pages publiques admises : toute nouvelle page doit être couverte par la table ou ajoutée ici. */
const PUBLIC_PAGES = [
  "/", "/commander/x", "/suivi/x", "/contact", "/demonstration", "/demo", "/fonctionnalites", "/tarifs", "/mentions-legales", "/confidentialite",
  "/login", "/login/client", "/login/driver", "/register", "/register/client", "/forgot-password", "/reset-password",
];

// Matrice attendue rôle × espace (comptes de référence, mini-admin avec tous ses modules).
const SPACES: Record<string, SystemRole[]> = {
  "/admin": ["SUPER_ADMIN"],
  "/admin/users": ["SUPER_ADMIN"],
  "/companies/x": ["SUPER_ADMIN"],
  "/dashboard": ["COMPANY_ADMIN", "MINI_ADMIN"],
  "/dashboard/analytics": ["COMPANY_ADMIN", "MINI_ADMIN"],
  "/dashboard/orders": ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER"],
  "/dashboard/orders/intake": ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER"],
  "/dashboard/orders/new": ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER"],
  "/dashboard/clients/x": ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER"],
  "/dashboard/drivers": ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER"],
  "/dashboard/deliveries/x": ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER"],
  "/dispatch": ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER"],
  "/dispatch/map": ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER"],
  "/dispatch/drivers": ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER"],
  "/dispatch/intake": ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER"],
  "/dispatch/new-order": ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER"],
  "/support": ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER"],
  "/users": ["COMPANY_ADMIN", "MINI_ADMIN"],
  "/settings": ["COMPANY_ADMIN", "MINI_ADMIN"],
  "/settings/billing": ["COMPANY_ADMIN", "MINI_ADMIN"],
  "/settings/subscription": ["COMPANY_ADMIN"],
  "/onboarding": ["COMPANY_ADMIN"],
  "/portal/orders": ["CLIENT"],
  "/portal/invoices/x": ["CLIENT"],
  "/driver/missions": ["DRIVER"],
  "/driver/navigate/x": ["DRIVER"],
};

test("AUTH-ROLE matrice : chaque rôle × espace est autorisé ou renvoyé vers son accueil", () => {
  for (const [path, allowed] of Object.entries(SPACES)) {
    for (const role of ROLES) {
      const decision = evaluatePageAccess(path, subject(role));
      if (allowed.includes(role)) {
        assert.deepEqual(decision, { kind: "allow" }, `${role} ${path}`);
      } else {
        assert.deepEqual(decision, { kind: "redirect", location: getRoleHomePath(role, subject(role).settings) }, `${role} ${path}`);
      }
    }
  }
});

test("AUTH-ROLE accueils : chaque rôle ouvre son espace, sans boucle de redirection", () => {
  assert.deepEqual(
    ROLES.map((role) => getRoleHomePath(role)),
    ["/admin", "/dashboard", "/dashboard", "/dispatch", "/driver", "/portal"]
  );
  for (const role of ROLES) {
    const home = getRoleHomePath(role, subject(role).settings);
    assert.deepEqual(evaluatePageAccess(home, subject(role)), { kind: "allow" }, role);
  }
  // Toute redirection vise une page elle-même autorisée.
  for (const modules of [[], ["support"], ["dispatch", "delivery-map"], ["billing"]] as MiniAdminModuleId[][]) {
    const mini = subject("MINI_ADMIN", modules);
    for (const path of Object.keys(SPACES)) {
      const decision = evaluatePageAccess(path, mini);
      if (decision.kind === "redirect") {
        assert.notEqual(decision.location, path);
        assert.deepEqual(evaluatePageAccess(decision.location, mini), { kind: "allow" }, `${modules} ${path}`);
      }
    }
  }
});

test("AUTH-ROLE mini-admin : un écran hors de ses modules est refusé côté serveur", () => {
  const support = subject("MINI_ADMIN", ["support"]);
  assert.equal(getRoleHomePath("MINI_ADMIN", support.settings), "/support");
  assert.deepEqual(evaluatePageAccess("/support", support), { kind: "allow" });
  for (const path of ["/dashboard", "/dispatch", "/dispatch/map", "/users", "/settings", "/dashboard/orders/x"]) {
    assert.deepEqual(evaluatePageAccess(path, support), { kind: "redirect", location: "/support" }, path);
  }
  const dispatch = subject("MINI_ADMIN", ["dispatch", "delivery-map"]);
  assert.deepEqual(evaluatePageAccess("/dispatch", dispatch), { kind: "allow" });
  assert.deepEqual(evaluatePageAccess("/dispatch/map", dispatch), { kind: "allow" });
  assert.deepEqual(evaluatePageAccess("/dashboard/deliveries/x", dispatch), { kind: "allow" });
  assert.deepEqual(evaluatePageAccess("/dispatch/drivers", dispatch), { kind: "redirect", location: "/dispatch" });
  // Saisie de commande : la permission orders:create vient du module Commandes, pas du Dispatch.
  assert.deepEqual(evaluatePageAccess("/dispatch/intake", dispatch), { kind: "redirect", location: "/dispatch" });
  assert.deepEqual(evaluatePageAccess("/dispatch/new-order", dispatch), { kind: "redirect", location: "/dispatch" });
  assert.deepEqual(evaluatePageAccess("/dashboard/orders/new", dispatch), { kind: "redirect", location: "/dispatch" });
  const orders = subject("MINI_ADMIN", ["orders"]);
  assert.deepEqual(evaluatePageAccess("/dashboard/orders/new", orders), { kind: "allow" });
  assert.deepEqual(evaluatePageAccess("/dispatch/new-order", orders), { kind: "allow" });
  assert.deepEqual(evaluatePageAccess("/support", dispatch), { kind: "redirect", location: "/dispatch" });
  // Aucun module : refus explicite (l'accueil par défaut lui est aussi fermé).
  assert.deepEqual(evaluatePageAccess("/dashboard", subject("MINI_ADMIN", [])), { kind: "forbidden" });
  assert.deepEqual(evaluatePageAccess("/support", subject("MINI_ADMIN", [])), { kind: "forbidden" });
});

test("AUTH-ROLE permissions : le rôle seul ne suffit pas, la permission relue en base est exigée", () => {
  const admin = { role: "COMPANY_ADMIN" as const, permissions: ["settings:read"], settings: {} };
  assert.deepEqual(evaluatePageAccess("/dashboard", admin), { kind: "forbidden" });
  assert.deepEqual(evaluatePageAccess("/settings", admin), { kind: "allow" });
  // Le super-admin a toutes les permissions mais reste dans l'espace plateforme.
  const superAdmin = subject("SUPER_ADMIN");
  for (const path of ["/dashboard", "/dispatch", "/portal", "/driver", "/users", "/settings"]) {
    assert.deepEqual(evaluatePageAccess(path, superAdmin), { kind: "redirect", location: "/admin" }, path);
  }
});

test("AUTH-ROLE inventaire : chaque page de src/app est publique (liste fermée) ou couverte par une règle", () => {
  const pages = discoverAllPages();
  assert.ok(pages.length >= 61, `pages trouvées : ${pages.length}`);
  const protectedPages = pages.filter((page) => !PUBLIC_PAGES.includes(page));
  assert.ok(protectedPages.length >= 49, `pages protégées : ${protectedPages.length}`);
  for (const page of protectedPages) {
    assert.equal(isProtectedPagePath(page), true, `page ni publique ni protégée : ${page}`);
    assert.ok(getPageAccessRule(page), page);
  }
  for (const page of PUBLIC_PAGES) {
    assert.ok(pages.includes(page), `page publique disparue : ${page}`);
    assert.equal(isProtectedPagePath(page), false, page);
  }
  // Frontière de segment : un préfixe homonyme n'est pas un espace.
  assert.equal(isProtectedPagePath("/portalx"), false);
  assert.equal(isProtectedPagePath("/administration"), false);
  // Un sous-chemin inconnu hérite de la règle de son espace (refus par défaut des autres rôles).
  assert.equal(getPageAccessRule("/dashboard/inconnu")?.path, "/dashboard");
});

test("AUTH-ROLE middleware : matcher couvrant tous les espaces, runtime Node, aucun en-tête relu", () => {
  const source = readFileSync("src/middleware.ts", "utf8");
  assert.match(source, /runtime: "nodejs"/);
  for (const space of PROTECTED_PAGE_SPACES) {
    assert.ok(source.includes(`"${space}",`) && source.includes(`"${space}/:path*",`), space);
  }
  assert.equal(source.includes("x-annona-auth-id"), false);
  assert.equal(source.includes("getServerAuth("), false);
  assert.equal(source.includes("user_metadata"), false);
});

test("AUTH-ROLE navigation : chaque lien du menu d'un rôle mène à une page qu'il peut ouvrir", () => {
  for (const role of ["SUPER_ADMIN", "COMPANY_ADMIN", "DISPATCHER", "MINI_ADMIN"] as const) {
    const s = subject(role);
    for (const item of getNavItemsForRole(role, s.settings)) {
      assert.deepEqual(evaluatePageAccess(item.href, s), { kind: "allow" }, `${role} ${item.href}`);
    }
  }
  for (const item of driverNavItems) {
    assert.deepEqual(evaluatePageAccess(item.href, subject("DRIVER")), { kind: "allow" }, item.href);
  }
});

type Auth = { user: { role: { systemRole: SystemRole }; settings: unknown }; permissions: string[] } | null;

function loadMiddleware(session: { id: string } | null, auth: Auth | Error, refreshed = false) {
  const module = { exports: {} as { middleware: (request: NextRequest) => Promise<Response> } };
  const source = ts.transpileModule(readFileSync("src/middleware.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const resolved: string[] = [];
  const dependencies: Record<string, unknown> = {
    "next/server": { NextResponse },
    "@/services/supabase/middleware": {
      updateSession: async () => {
        const supabaseResponse = NextResponse.next();
        if (refreshed) supabaseResponse.cookies.set("sb-x-auth-token", "rotated", { httpOnly: true, maxAge: 3600 });
        return { supabaseResponse, user: session };
      },
    },
    "@/lib/constants": { AUTH_ROUTES: ["/login", "/register", "/forgot-password", "/reset-password", "/login/client", "/login/driver"] },
    "@/lib/demo/constants": { DEMO_PERSONA_COOKIE: "annona-demo-persona", DEMO_SESSION_COOKIE: "annona-demo-session" },
    "@/lib/security/origin-check": { isCrossOriginMutation: () => false, isOriginCheckExempt: () => false },
    "@/lib/permissions/page-access": pageAccess,
    "@/lib/api/server-auth": {
      resolveServerAuthForAuthId: async (authId: string) => {
        resolved.push(authId);
        if (auth instanceof Error) throw auth;
        return auth;
      },
    },
  };
  runInNewContext(source, {
    exports: module.exports,
    module,
    URL,
    Date,
    Map,
    require: (id: string) => {
      assert.ok(id in dependencies, `Unexpected dependency ${id}`);
      return dependencies[id];
    },
  });
  return { middleware: module.exports.middleware, resolved };
}

/** Comme en base : les permissions du mini-admin sont filtrées par ses modules (`extractPermissionSlugs`). */
const asRole = (role: SystemRole, settings: unknown = {}) => ({
  user: { role: { systemRole: role }, settings },
  permissions: role === "MINI_ADMIN"
    ? filterMiniAdminPermissions([...ROLE_PERMISSIONS[role]], settings)
    : [...ROLE_PERMISSIONS[role]],
});

async function call(session: { id: string } | null, auth: Auth, path: string, headers: Record<string, string> = {}) {
  const { middleware, resolved } = loadMiddleware(session, auth);
  const response = await middleware(new NextRequest(`http://localhost:3110${path}`, { headers }));
  return { status: response.status, location: response.headers.get("location"), resolved, response };
}

test("AUTH-ROLE middleware : mauvais rôle redirigé côté serveur, y compris en RSC et préchargement", async () => {
  const client = await call({ id: "auth-client" }, asRole("CLIENT"), "/dashboard");
  assert.equal(client.status, 307);
  assert.equal(client.location, "http://localhost:3110/portal");
  assert.deepEqual(client.resolved, ["auth-client"]);

  for (const headers of [{ RSC: "1" }, { RSC: "1", "Next-Router-Prefetch": "1" }] as Record<string, string>[]) {
    const rsc = await call({ id: "auth-driver" }, asRole("DRIVER"), "/portal/orders?_rsc=abc", headers);
    assert.equal(rsc.status, 307);
    // AUDIT-0411 : la page d'arrivée explique le renvoi (sauf pour « /dashboard », adresse par défaut).
    assert.equal(rsc.location, "http://localhost:3110/driver?acces-refuse=1");
  }
  // En-tête interne usurpé : ignoré, la décision vient de l'authId validé et de la base.
  const spoofed = await call({ id: "auth-client" }, asRole("CLIENT"), "/dispatch", { "x-annona-auth-id": "auth-admin" });
  assert.equal(spoofed.status, 307);
  assert.deepEqual(spoofed.resolved, ["auth-client"]);

  const allowed = await call({ id: "auth-dispatcher" }, asRole("DISPATCHER"), "/dispatch/map");
  assert.equal(allowed.status, 200);
  assert.equal(allowed.response.headers.get("x-middleware-next"), "1");
});

test("AUTH-ROLE middleware : anonyme, compte inactif, connexion et refus explicite", async () => {
  const anonymous = await call(null, null, "/driver/missions");
  assert.equal(anonymous.status, 307);
  assert.equal(anonymous.location, "http://localhost:3110/login/driver?redirect=%2Fdriver%2Fmissions");
  assert.deepEqual(anonymous.resolved, []);

  // Session valide mais compte désactivé / entreprise suspendue / démo expirée : connexion.
  const inactive = await call({ id: "auth-off" }, null, "/dashboard");
  assert.equal(inactive.status, 307);
  assert.equal(inactive.location, "http://localhost:3110/login?redirect=%2Fdashboard");
  // … et la page de connexion reste affichée : pas de boucle.
  const inactiveLogin = await call({ id: "auth-off" }, null, "/login");
  assert.equal(inactiveLogin.status, 200);

  const clientLogin = await call({ id: "auth-client" }, asRole("CLIENT"), "/login");
  assert.equal(clientLogin.status, 307);
  assert.equal(clientLogin.location, "http://localhost:3110/portal");

  const noModule = await call({ id: "auth-mini" }, asRole("MINI_ADMIN", buildMiniAdminSettings("x", [])), "/dashboard");
  assert.equal(noModule.status, 403);
  assert.match(await noModule.response.text(), /Accès refusé/);
  const noModuleLogin = await call({ id: "auth-mini" }, asRole("MINI_ADMIN", buildMiniAdminSettings("x", [])), "/login");
  assert.equal(noModuleLogin.status, 200);

  const publicPage = await call({ id: "auth-client" }, asRole("CLIENT"), "/demonstration");
  assert.equal(publicPage.status, 200);
  assert.deepEqual(publicPage.resolved, []);
});

test("AUTH-ROLE middleware : cookies rafraîchis conservés, no-store, base en panne refusée, rafales mémorisées", async () => {
  const { middleware, resolved } = loadMiddleware({ id: "auth-client" }, asRole("CLIENT"), true);
  const redirect = await middleware(new NextRequest("http://localhost:3110/dashboard"));
  assert.equal(redirect.status, 307);
  assert.equal(redirect.headers.get("cache-control"), "no-store");
  assert.match(redirect.headers.get("set-cookie") ?? "", /sb-x-auth-token=rotated.*HttpOnly/i);
  // Rafale de préchargements : une seule relecture en base pour la même session et persona…
  await Promise.all(["/dispatch", "/driver", "/users"].map((path) => middleware(new NextRequest(`http://localhost:3110${path}`))));
  assert.deepEqual(resolved, ["auth-client"]);
  // … mais un changement de persona de démo relit la base.
  await middleware(new NextRequest("http://localhost:3110/portal", { headers: { cookie: "annona-demo-persona=driver" } }));
  assert.deepEqual(resolved, ["auth-client", "auth-client"]);

  const down = loadMiddleware({ id: "auth-x" }, new Error("db down"), true);
  const failed = await down.middleware(new NextRequest("http://localhost:3110/dashboard"));
  assert.equal(failed.status, 503);
  assert.equal(failed.headers.get("cache-control"), "no-store");
  assert.equal(failed.headers.get("x-middleware-next"), null);
  const loginWhileDown = await down.middleware(new NextRequest("http://localhost:3110/login"));
  assert.equal(loginWhileDown.status, 200);
});
