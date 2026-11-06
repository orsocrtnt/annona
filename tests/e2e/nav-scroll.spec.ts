import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

// UX-NAV-SCROLL (lot e-finitions). Le défilement est celui du document dans les quatre espaces ; on mesure
// donc `document.scrollingElement.scrollTop`.
// Comptes : `npm run e2e:role-accounts -- setup` (back-office), session de démonstration (portail).
type Account = { email: string; password: string };
const accounts = (): Record<"billingAdminA", Account> | null => {
  try {
    return JSON.parse(readFileSync(resolve("outputs/e2e-role-accounts.json"), "utf8"));
  } catch {
    return null;
  }
};
const scrollTop = (page: Page) => page.evaluate(() => (document.scrollingElement ?? document.documentElement).scrollTop);
const scrollDown = async (page: Page, y: number) => {
  // Le contenu se charge après le premier rendu : attendre que la page soit assez haute pour défiler de `y`.
  await expect
    .poll(() => page.evaluate(() => (document.scrollingElement ?? document.documentElement).scrollHeight - window.innerHeight))
    .toBeGreaterThanOrEqual(y);
  await page.evaluate((top) => (document.scrollingElement ?? document.documentElement).scrollTo({ top, behavior: "instant" }), y);
  await expect.poll(() => scrollTop(page)).toBeGreaterThan(50);
};
const widths = [
  { width: 1280, height: 720 },
  { width: 390, height: 844 },
];

for (const size of widths) {
  test(`UX-NAV-SCROLL : menu administrateur, haut de page puis position restaurée au Retour (${size.width} px)`, async ({ page }) => {
    const roles = accounts();
    test.skip(!roles, "comptes de rôle absents : npm run e2e:role-accounts -- setup");
    await page.setViewportSize(size);
    expect((await page.request.post("/api/auth/login", { data: { ...roles!.billingAdminA, accountType: "company" } })).status()).toBe(200);
    try {
      await page.goto("/settings");
      await expect(page.getByRole("main")).toBeVisible();
      await scrollDown(page, 400);
      const before = await scrollTop(page);
      const link = size.width >= 1024
        ? page.getByRole("link", { name: "Facturation", exact: true }).first()
        : page.getByRole("link", { name: /Facturation/ }).first();
      if (size.width < 1024) await page.getByRole("button", { name: /menu/i }).first().click();
      await link.click();
      await page.waitForURL(/\/settings\/billing/);
      await expect.poll(() => scrollTop(page)).toBe(0);
      await page.goBack();
      await page.waitForURL(/\/settings$/);
      await expect.poll(() => scrollTop(page)).toBeGreaterThan(before - 120);
      await page.goForward();
      await page.waitForURL(/\/settings\/billing/);
    } finally {
      await page.request.post("/api/auth/logout").catch(() => undefined);
    }
  });
}

test("UX-NAV-SCROLL : site public, un lien vers une autre page démarre en haut", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  await scrollDown(page, 600);
  await page.getByRole("navigation", { name: "Navigation publique" }).getByRole("link", { name: "Tarifs" }).click();
  await page.waitForURL(/\/tarifs/);
  await expect.poll(() => scrollTop(page)).toBe(0);
});

for (const size of widths) {
  test(`UX-NAV-SCROLL : portail client, /portal/settings vers /portal/orders démarre en haut (${size.width} px)`, async ({ page }) => {
    await page.setViewportSize(size);
    const login = await page.request.post("/api/auth/login", {
      data: { email: "demo@annona.fr", password: "Demo2026!", demoTestSession: true, accountType: "company" },
    });
    expect(login.status()).toBe(200);
    // Le compte de démonstration est administrateur : sans la vue Client, la protection par rôle renvoie vers /dashboard.
    expect((await page.request.post("/api/demo/persona", { data: { persona: "client" } })).status()).toBe(200);
    try {
      await page.goto("/portal/settings");
      await scrollDown(page, 400);
      // Sous 1 024 px, la navigation passe dans un menu : « Mes commandes » y est un élément de menu.
      if (size.width < 1024) {
        await page.getByRole("button", { name: "Ouvrir la navigation client" }).click();
        await page.getByRole("menuitem", { name: "Mes commandes" }).click();
      } else {
        await page.getByRole("link", { name: "Mes commandes" }).first().click();
      }
      await page.waitForURL(/\/portal\/orders/);
      await expect.poll(() => scrollTop(page)).toBe(0);
    } finally {
      await page.request.post("/api/auth/logout").catch(() => undefined);
    }
  });
}

test("UX-NAV-SCROLL : une ancre garde sa position (pas de retour en haut)", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  await scrollDown(page, 300);
  // Ancre réelle posée par le test sur un élément bas de page : le hash seul ne change pas le chemin.
  await page.evaluate(() => {
    const target = document.createElement("div");
    target.id = "e2e-ancre";
    target.style.cssText = "position:absolute;top:1200px;height:10px";
    document.body.appendChild(target);
    window.location.hash = "e2e-ancre";
  });
  await expect.poll(() => scrollTop(page)).toBeGreaterThan(600);
});

test("UX-NAV-SCROLL : un changement de recherche seul ne remonte pas", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  await scrollDown(page, 500);
  const before = await scrollTop(page);
  await page.evaluate(() => window.history.pushState(null, "", `${window.location.pathname}?filtre=e2e`));
  // Deux images suffisent à un éventuel retour en haut déclenché par la navigation.
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  expect(await scrollTop(page)).toBeGreaterThanOrEqual(before - 5);
});
