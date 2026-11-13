/**
 * RECETTE-V1 — contrôle rapide des quatre rôles avec les comptes du seed (`npm run db:seed` sur annona-dev).
 *
 * Chaque rôle se connecte par son écran, arrive dans son espace sans erreur JavaScript, lit l'API de son rôle
 * (200) et se voit refuser celles des autres rôles (403). La journée complète des dix critères est dans
 * `recette-v1.spec.ts` ; ici, rien n'est écrit en base (boulanger : date dans 30 jours, jamais verrouillée).
 *
 * Comptes lus dans `outputs/comptes-demo.json` (ignoré par git, jamais affiché) : clés `admin`, `boulanger`,
 * `client-1`, `livreur-1`. Un rôle dont le compte manque est sauté.
 *
 *   npx playwright test tests/e2e/v1-roles.spec.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

type Account = { email: string; password: string };

function demoAccounts(): Record<string, Account> {
  try {
    return JSON.parse(readFileSync(resolve("outputs/comptes-demo.json"), "utf8")) as Record<string, Account>;
  } catch {
    return {};
  }
}

const accounts = demoAccounts();

// Date lointaine pour les commandes (admin) et la production (boulanger) : avant l'heure limite,
// la lecture ne verrouille rien (LOCK-1).
const FUTURE_DAY = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

const API = {
  admin: `/api/orders?date=${FUTURE_DAY}`,
  boulanger: `/api/production?date=${FUTURE_DAY}`,
  "client-1": "/api/portal/orders?history=false",
  "livreur-1": "/api/driver/rounds",
} as const;

type RoleKey = keyof typeof API;

const ROLES: Array<{ key: RoleKey; label: string; loginPath: string; home: string; page: string }> = [
  { key: "admin", label: "admin (ADM)", loginPath: "/login", home: "/dashboard", page: "/dashboard" },
  { key: "boulanger", label: "boulanger (BOU)", loginPath: "/login", home: "/bakery", page: `/bakery?date=${FUTURE_DAY}` },
  { key: "client-1", label: "client (CLI)", loginPath: "/login/client", home: "/portal", page: "/portal/orders" },
  { key: "livreur-1", label: "livreur (LIV)", loginPath: "/login/driver", home: "/driver", page: "/driver" },
];

async function login(page: Page, account: Account, loginPath: string, home: string) {
  await page.goto(loginPath);
  await page.locator('input[type="email"]').fill(account.email);
  await page.locator('input[name="password"]').fill(account.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL((url) => url.pathname.startsWith(home), { timeout: 60_000 });
}

test.describe.configure({ timeout: 120_000 });

test.afterEach(async ({ page }) => {
  await page.request.post("/api/auth/logout").catch(() => undefined);
});

for (const role of ROLES) {
  test(`RECETTE-V1 : ${role.label} — son espace, son API, et les API des autres rôles refusées`, async ({ page }) => {
    const account = accounts[role.key];
    test.skip(!account, `compte « ${role.key} » absent de outputs/comptes-demo.json`);

    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await login(page, account!, role.loginPath, role.home);
    await page.goto(role.page);
    await expect(page).toHaveURL((url) => url.pathname.startsWith(role.home));
    await expect(page.locator("main h1").first()).toBeVisible({ timeout: 30_000 });

    const own = await page.request.get(API[role.key]);
    expect(own.status(), `${role.key} lit ${API[role.key]}`).toBe(200);

    for (const [other, path] of Object.entries(API) as Array<[RoleKey, string]>) {
      if (other === role.key) continue;
      const denied = await page.request.get(path);
      expect(denied.status(), `${role.key} refusé sur ${path}`).toBe(403);
    }

    expect(pageErrors).toEqual([]);
  });
}

test("RECETTE-V1 : sans session, les API de rôle répondent 401", async ({ request }) => {
  for (const path of Object.values(API)) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(401);
  }
});
