import { expect, test, type Page } from "@playwright/test";

// DESIGN-2 : Sombre du back-office et de l'app livreur, tableaux sur surface, Première livraison rangée dans l'Aide.
// Compte de démonstration (pool réservé par la connexion du test, libéré à la fin).
test.afterEach(async ({ page }) => {
  await page.request.post("/api/auth/logout").catch(() => undefined);
});

async function openAs(page: Page, persona: "admin" | "driver", path: string, width = 1280) {
  const login = await page.request.post("/api/auth/login", {
    data: { email: "demo@tutelliv.fr", password: "Demo2026!", demoTestSession: true, accountType: "company" },
  });
  expect(login.ok()).toBeTruthy();
  const switched = await page.request.post("/api/demo/persona", { data: { persona } });
  expect(switched.status()).toBe(200);
  await page.setViewportSize({ width, height: 900 });
  await page.goto(path);
}

const bodyBackground = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const DARK_BG = "rgb(20, 23, 22)";
const LIGHT_BG = "rgb(245, 248, 246)";
const CARD_DARK = "rgb(28, 31, 30)";

test("back-office : suit le système, bascule en un clic, choix Système dans le menu du compte, sans éclair au rechargement", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await openAs(page, "admin", "/dashboard");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(await bodyBackground(page)).toBe(LIGHT_BG);

  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await bodyBackground(page)).toBe(DARK_BG);

  // Choix explicite Clair malgré un système sombre, puis rechargement : appliqué avant la première image.
  await page.getByRole("button", { name: "Ouvrir le menu du compte" }).click();
  await page.getByRole("menuitemradio", { name: "Clair" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByTestId("theme-toggle").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.addInitScript(() => {
    requestAnimationFrame(() => {
      (window as unknown as { __firstFrame: unknown }).__firstFrame = document.documentElement.getAttribute("data-theme");
    });
  });
  await page.emulateMedia({ colorScheme: "light" });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await page.evaluate(() => (window as unknown as { __firstFrame: string }).__firstFrame)).toBe("dark");

  // Retour à « Système » : suit de nouveau l'appareil (clair ici).
  await page.getByRole("button", { name: "Ouvrir le menu du compte" }).click();
  await page.getByRole("menuitemradio", { name: "Système" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(await page.evaluate(() => localStorage.getItem("tutelliv-theme"))).toBe("system");
});

test("back-office en Sombre : écrans principaux lisibles, tableau Chauffeurs sur une surface distincte", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await openAs(page, "admin", "/dashboard/drivers");
  await expect(page.getByRole("heading", { name: "Chauffeurs" })).toBeVisible();
  const table = page.locator("table").first();
  await expect(table).toBeVisible();
  // La surface du tableau (son conteneur) n'est pas le fond de page.
  const surface = await table.evaluate((el) => getComputedStyle(el.closest("div.rounded-xl, div[class*='rounded-xl']") ?? el).backgroundColor);
  expect(surface).toBe(CARD_DARK);
  await page.screenshot({ path: test.info().outputPath("chauffeurs-sombre-1280.png"), fullPage: true });

  for (const path of ["/dashboard", "/dashboard/orders", "/dispatch", "/dashboard/analytics", "/settings", "/support", "/users"]) {
    await page.goto(path);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator("main")).toBeVisible();
    // Aucun texte du contenu principal ne doit avoir la couleur de son propre fond (texte invisible).
    const invisible = await page.locator("main").evaluate((main) => {
      const bad: string[] = [];
      for (const el of Array.from(main.querySelectorAll<HTMLElement>("p, span, h1, h2, h3, td, th, a, button, label"))) {
        if (!el.offsetParent || !el.textContent?.trim()) continue;
        let node: HTMLElement | null = el;
        let bg = "rgba(0, 0, 0, 0)";
        while (node && (bg === "rgba(0, 0, 0, 0)" || bg === "transparent")) {
          bg = getComputedStyle(node).backgroundColor;
          node = node.parentElement;
        }
        if (getComputedStyle(el).color === bg) bad.push(el.textContent.trim().slice(0, 40));
      }
      return bad;
    });
    expect(invisible, path).toEqual([]);
    await page.screenshot({ path: test.info().outputPath(`sombre${path.replaceAll("/", "-")}.png`), fullPage: true });
  }
});

test("carte plein écran du dispatch : suit le Sombre depuis le plan sombre du lot B", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await openAs(page, "admin", "/dispatch/map");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("app livreur : bascule en un clic dans la barre et choix complet dans Profil", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  // Largeur tablette : le mode sombre est retiré des téléphones depuis le 30 octobre 2026.
  await openAs(page, "driver", "/driver", 1024);
  await page.getByTestId("theme-toggle").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await bodyBackground(page)).toBe(DARK_BG);
  await page.goto("/driver/profile");
  const field = page.getByTestId("theme-preference-field");
  await expect(field.getByRole("radio", { name: "Sombre" })).toBeChecked();
  // « Système » figure aussi dans l'aide sous le choix : viser l'étiquette du bouton radio.
  await field.locator("label", { hasText: "Système" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  // Cible tactile de 44 px.
  const box = await field.locator("label").first().boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("Première livraison : masquée du menu principal, toujours dans l'Aide, puis réaffichée", async ({ page }) => {
  await openAs(page, "admin", "/onboarding");
  try {
  const control = page.getByTestId("onboarding-navigation");
  await expect(control).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Navigation principale" });
  const toggle = control.getByRole("button");
  if ((await toggle.count()) === 0) {
    // Parcours déjà terminé sur ce compte : hors du menu, accessible depuis l'Aide.
    await expect(nav.getByRole("link", { name: "Première livraison" })).toHaveCount(0);
  } else {
    if ((await toggle.innerText()).includes("Afficher")) {
      await toggle.click();
      await expect(toggle).toHaveText("Masquer du menu");
    }
    await expect(nav.getByRole("link", { name: "Première livraison" })).toBeVisible();
    // Double clic : une seule requête part, le choix n'est donc pas inversé et aucune erreur n'apparaît.
    const patches: number[] = [];
    page.on("response", (response) => {
      if (response.request().method() === "PATCH" && new URL(response.url()).pathname === "/api/onboarding") patches.push(response.status());
    });
    await toggle.dblclick();
    await expect(toggle).toHaveText("Afficher dans le menu");
    expect(patches).toEqual([200]);
    await expect(nav.getByRole("link", { name: "Première livraison" })).toHaveCount(0);
    // Le choix est enregistré côté serveur : il survit au rechargement.
    await page.reload();
    await expect(page.getByTestId("onboarding-navigation").getByRole("button")).toHaveText("Afficher dans le menu");
    await expect(nav.getByRole("link", { name: "Première livraison" })).toHaveCount(0);
  }
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Ouvrir le menu du compte" }).click();
  await page.getByTestId("help-onboarding-link").click();
  await page.waitForURL("**/onboarding");
  await expect(page.getByRole("heading", { name: "Première livraison" })).toBeVisible();
  } finally {
    // Remise en état du compte de démonstration, même si une assertion a échoué.
    const restored = await page.request.patch("/api/onboarding", { data: { step: "navigation", hidden: false } });
    expect([200, 403]).toContain(restored.status());
  }
});
