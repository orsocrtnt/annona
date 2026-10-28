import { expect, test, type Page } from "@playwright/test";

// Libère l'espace du pool de démonstration réservé par la connexion du test.
test.afterEach(async ({ page }) => {
  await page.request.post("/api/auth/logout").catch(() => undefined);
});

async function openPortal(page: Page, path = "/portal") {
  const login = await page.request.post("/api/auth/login", {
    data: { email: "demo@tutelliv.fr", password: "Demo2026!", demoTestSession: true, accountType: "company" },
  });
  expect(login.ok()).toBeTruthy();
  const persona = await page.request.post("/api/demo/persona", { data: { persona: "client" } });
  expect(persona.status()).toBe(200);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(path);
}

const bodyBackground = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test("le portail suit le thème du système par défaut, clair puis sombre", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await openPortal(page);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(await bodyBackground(page)).toBe("rgb(245, 248, 246)");

  // Le thème du système est suivi en direct tant que la préférence reste « Système ».
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await bodyBackground(page)).toBe("rgb(20, 23, 22)");
});

test("le choix sombre est mémorisé, appliqué avant l'hydratation et survit au rechargement", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await openPortal(page);

  await page.getByTestId("theme-toggle").click();
  await page.getByRole("menuitemradio", { name: "Sombre" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await bodyBackground(page)).toBe("rgb(20, 23, 22)");

  await page.reload();
  // Le script d'initialisation pose l'attribut dès le premier rendu (aucun flash clair).
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await page.evaluate(() => localStorage.getItem("tutelliv-theme"))).toBe("dark");
  await page.screenshot({ path: test.info().outputPath("portail-sombre.png"), fullPage: true });

  await page.getByTestId("theme-toggle").click();
  await page.getByRole("menuitemradio", { name: "Clair" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(await bodyBackground(page)).toBe("rgb(245, 248, 246)");
});

test("le basculement de thème se manœuvre au clavier et garde un focus visible", async ({ page }) => {
  await openPortal(page);
  const toggle = page.getByTestId("theme-toggle");
  await toggle.focus();
  await expect(toggle).toBeFocused();
  await page.keyboard.press("Enter");
  const dark = page.getByRole("menuitemradio", { name: "Sombre" });
  await expect(dark).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(toggle).toBeFocused();
});

test("les pages principales du portail restent lisibles en sombre et les cibles font au moins 44 px", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await openPortal(page, "/portal/orders/new");
  await expect(page.getByRole("heading", { name: "Nouvelle commande" })).toBeVisible();

  const submit = page.getByRole("button", { name: /Créer la commande|Demander un devis/ });
  await expect(submit).toBeVisible();
  const box = await submit.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);

  for (const path of ["/portal/orders", "/portal/recurring", "/portal/invoices", "/portal/settings"]) {
    await page.goto(path);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator("main")).toBeVisible();
  }
});

test("les autres espaces ne sont pas assombris par le thème du système", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  expect(await page.locator("html").getAttribute("data-theme")).toBeNull();
});

test("la barre du portail ne déborde pas à 320, 375 et 390 px et le thème reste accessible", async ({ page }) => {
  await openPortal(page);
  for (const width of [320, 375, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.reload();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `débordement horizontal à ${width}px`).toBeLessThanOrEqual(0);
    const header = page.locator("header").first();
    const bar = await header.locator("> div").first().boundingBox();
    expect((bar?.x ?? 0) + (bar?.width ?? 0)).toBeLessThanOrEqual(width);
  }
  await page.getByRole("button", { name: "Ouvrir la navigation client" }).click();
  await page.getByRole("menuitemradio", { name: "Sombre" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("la navigation client portail vers un autre espace retire le thème sombre", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await openPortal(page);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.goto("/");
  expect(await page.locator("html").getAttribute("data-theme")).toBeNull();
});
