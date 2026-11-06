import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, request, test, type APIRequestContext } from "@playwright/test";

// AUTH-ROLE : refus serveur des pages du mauvais rôle. Requêtes HTTP sans suivre les redirections
// (`maxRedirects: 0`) : autorisé → 200 et HTML de la page ; interdit → 307 vers l'espace du rôle ;
// anonyme → 307 vers la connexion. Comptes : personas de démo (admin, client, livreur) et comptes
// de recette de `scripts/e2e/dev-role-accounts.ts setup` sur la base de développement uniquement.

type Account = { email: string; password: string };
type RoleKey = "dispatcher" | "miniAdminDispatch" | "miniAdminSupport" | "superAdmin" | "billingAdminA";

const roleAccounts = (): Record<RoleKey, Account> | null => {
  try {
    return JSON.parse(readFileSync(resolve("outputs/e2e-role-accounts.json"), "utf8"));
  } catch {
    return null;
  }
};

const SPACES = [
  "/admin",
  "/admin/users",
  "/companies",
  "/dashboard",
  "/dashboard/analytics",
  "/dashboard/orders",
  "/dashboard/clients",
  "/dashboard/drivers",
  "/dispatch",
  "/dispatch/map",
  "/dispatch/drivers",
  "/dispatch/intake",
  "/support",
  "/users",
  "/settings",
  "/settings/billing",
  "/settings/subscription",
  "/onboarding",
  "/portal",
  "/portal/orders",
  "/portal/invoices",
  "/driver",
  "/driver/missions",
  "/driver/profile",
] as const;

type Expectation = { home: string; allowed: readonly string[] };

const COMPANY_ADMIN: Expectation = {
  home: "/dashboard",
  allowed: [
    "/dashboard", "/dashboard/analytics", "/dashboard/orders", "/dashboard/clients", "/dashboard/drivers",
    "/dispatch", "/dispatch/map", "/dispatch/drivers", "/dispatch/intake", "/support", "/users",
    "/settings", "/settings/billing", "/settings/subscription", "/onboarding",
  ],
};

const EXPECTED: Record<"admin" | "client" | "driver" | RoleKey, Expectation> = {
  admin: COMPANY_ADMIN,
  billingAdminA: COMPANY_ADMIN,
  client: { home: "/portal", allowed: ["/portal", "/portal/orders", "/portal/invoices"] },
  driver: { home: "/driver", allowed: ["/driver", "/driver/missions", "/driver/profile"] },
  dispatcher: {
    home: "/dispatch",
    allowed: [
      "/dashboard/orders", "/dashboard/clients", "/dashboard/drivers",
      "/dispatch", "/dispatch/map", "/dispatch/drivers", "/dispatch/intake", "/support",
    ],
  },
  // Mini-admin avec les modules Dispatch et Carte livraison : ni carte livreurs, ni saisie, ni comptes.
  miniAdminDispatch: { home: "/dispatch", allowed: ["/dispatch", "/dispatch/map"] },
  // Mini-admin avec le seul module Support : tout autre écran le renvoie au support.
  miniAdminSupport: { home: "/support", allowed: ["/support"] },
  superAdmin: { home: "/admin", allowed: ["/admin", "/admin/users", "/companies"] },
};

async function newClient(baseURL: string | undefined) {
  return request.newContext({ baseURL, maxRedirects: 0 });
}

async function expectMatrix(api: APIRequestContext, actor: keyof typeof EXPECTED) {
  const { home, allowed } = EXPECTED[actor];
  for (const path of SPACES) {
    const response = await api.get(path, { maxRedirects: 0 });
    const label = `${actor} ${path}`;
    if (allowed.includes(path)) {
      expect(response.status(), label).toBe(200);
      expect(response.headers()["content-type"], label).toContain("text/html");
    } else {
      expect(response.status(), label).toBe(307);
      expect(new URL(response.headers().location!, "http://x").pathname, label).toBe(home);
      // Aucune page rendue : le corps d'une redirection serveur ne contient pas l'application.
      expect(await response.text(), label).not.toContain("__next_f");
    }
  }
  // Requête RSC et préchargement d'un écran interdit : même redirection serveur.
  const forbidden = SPACES.find((path) => !allowed.includes(path))!;
  for (const headers of [{ RSC: "1" }, { RSC: "1", "Next-Router-Prefetch": "1" }] as Record<string, string>[]) {
    const rsc = await api.get(`${forbidden}?_rsc=e2e`, { maxRedirects: 0, headers });
    expect(rsc.status(), `${actor} RSC ${forbidden}`).toBe(307);
    expect(new URL(rsc.headers().location!, "http://x").pathname).toBe(home);
  }
  // Une session connectée qui revient sur /login est renvoyée vers son espace.
  const login = await api.get("/login", { maxRedirects: 0 });
  expect(login.status(), `${actor} /login`).toBe(307);
  expect(new URL(login.headers().location!, "http://x").pathname).toBe(home);
}

test.describe.configure({ mode: "serial" });

test("AUTH-ROLE : anonyme renvoyé vers la connexion de chaque espace", async ({ baseURL }) => {
  const api = await newClient(baseURL);
  for (const path of SPACES) {
    const response = await api.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(307);
    const location = new URL(response.headers().location!, "http://x");
    const loginPath = path.startsWith("/portal") ? "/login/client" : path.startsWith("/driver") ? "/login/driver" : "/login";
    expect(location.pathname, path).toBe(loginPath);
    expect(location.searchParams.get("redirect"), path).toBe(path);
  }
  for (const path of ["/", "/login", "/login/client", "/login/driver", "/register", "/fonctionnalites", "/tarifs"]) {
    expect((await api.get(path, { maxRedirects: 0 })).status(), path).toBe(200);
  }
  await api.dispose();
});

test("AUTH-ROLE : personas de démo admin → client → livreur → admin", async ({ baseURL }) => {
  test.setTimeout(600_000);
  const api = await newClient(baseURL);
  try {
    const login = await api.post("/api/auth/login", {
      data: { email: "demo@annona.fr", password: "Demo2026!", demoTestSession: true },
    });
    expect(login.status()).toBe(200);
    for (const persona of ["admin", "client", "driver"] as const) {
      expect((await api.post("/api/demo/persona", { data: { persona } })).status()).toBe(200);
      await expectMatrix(api, persona);
    }
    // Retour arrière vers l'administrateur : l'espace livreur est de nouveau refusé.
    expect((await api.post("/api/demo/persona", { data: { persona: "admin" } })).status()).toBe(200);
    const back = await api.get("/driver/missions", { maxRedirects: 0 });
    expect(back.status()).toBe(307);
    expect(new URL(back.headers().location!, "http://x").pathname).toBe("/dashboard");
    expect((await api.get("/dispatch", { maxRedirects: 0 })).status()).toBe(200);
  } finally {
    // Libère l'espace du pool de démonstration.
    await api.post("/api/auth/logout").catch(() => undefined);
    await api.dispose();
  }
});

for (const key of ["dispatcher", "miniAdminDispatch", "miniAdminSupport", "superAdmin", "billingAdminA"] as const) {
  test(`AUTH-ROLE : compte de recette ${key}`, async ({ baseURL }) => {
    test.setTimeout(600_000);
    const accounts = roleAccounts();
    test.skip(!accounts, "Comptes de recette absents : lancer scripts/e2e/dev-role-accounts.ts setup");
    const api = await newClient(baseURL);
    try {
      expect((await api.post("/api/auth/login", { data: accounts![key] })).status()).toBe(200);
      await expectMatrix(api, key);
    } finally {
      await api.post("/api/auth/logout").catch(() => undefined);
      await api.dispose();
    }
  });
}
