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
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await bodyBackground(page)).toBe("rgb(20, 23, 22)");

  // Avant la première peinture du rechargement : le premier requestAnimationFrame voit déjà le Dark.
  await page.addInitScript(() => {
    requestAnimationFrame(() => {
      (window as unknown as { __firstFrame: unknown }).__firstFrame = {
        theme: document.documentElement.getAttribute("data-theme"),
        bg: document.body ? getComputedStyle(document.body).backgroundColor : null,
      };
    });
  });
  await page.reload();
  // Le script d'initialisation pose l'attribut dès le premier rendu (aucun flash clair).
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const first = await page.evaluate(() => (window as unknown as { __firstFrame: { theme: string; bg: string | null } }).__firstFrame);
  expect(first.theme).toBe("dark");
  if (first.bg) expect(first.bg).toBe("rgb(20, 23, 22)");
  expect(await page.evaluate(() => localStorage.getItem("tutelliv-theme"))).toBe("dark");
  await page.screenshot({ path: test.info().outputPath("portail-sombre.png"), fullPage: true });

  await page.getByTestId("theme-toggle").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(await bodyBackground(page)).toBe("rgb(245, 248, 246)");
});

test("le basculement de thème se manœuvre au clavier et garde un focus visible", async ({ page }) => {
  await openPortal(page);
  const toggle = page.getByTestId("theme-toggle");
  await toggle.focus();
  await expect(toggle).toBeFocused();
  // Un appui bascule directement en Sombre, sans menu intermédiaire.
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(toggle).toHaveAccessibleName("Passer en mode clair");
  // Focus visible au clavier.
  expect(await toggle.evaluate((el) => getComputedStyle(el).boxShadow)).not.toBe("none");
  // Un second appui revient en Clair.
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
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
  // L'avatar quitte la barre sous 640 px : le compte connecté doit être repris dans le menu.
  const account = page.getByTestId("portal-mobile-account");
  await expect(account).toBeVisible();
  expect((await account.innerText()).trim().length).toBeGreaterThan(1);
  await page.getByRole("menuitem", { name: "Mode sombre" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

/** Enregistre, à chaque image (avant peinture), le chemin, le thème et la présence du portail. */
async function recordFrames(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __frames: { path: string; theme: string | null; portal: boolean; sora: boolean }[] };
    w.__frames = [];
    const tick = () => {
      w.__frames.push({
        path: location.pathname,
        theme: document.documentElement.getAttribute("data-theme"),
        portal: document.querySelector("[data-portal-root]") !== null,
        sora: document.documentElement.hasAttribute("data-portal"),
      });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
const frames = (page: Page) =>
  page.evaluate(() => (window as unknown as { __frames: { path: string; theme: string | null; portal: boolean; sora: boolean }[] }).__frames);

async function switchPersona(page: Page, label: "Administrateur" | "Client") {
  await page.getByRole("combobox", { name: "Changer de vue de démonstration" }).click();
  await page.getByRole("option", { name: label }).click();
}

test("navigation client portail ↔ dashboard : le Dark suit l'utilisateur sans clignoter, Sora reste au portail", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await openPortal(page);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  // Portail → dashboard par clic (barre de démonstration, router.push) : aucun rechargement complet.
  // DESIGN-2 : le back-office est migré, il reste en Dark à chaque image ; seule la police Sora est propre au portail.
  await recordFrames(page);
  await switchPersona(page, "Administrateur");
  await page.waitForURL("**/dashboard");
  await expect(page.locator("[data-portal-root]")).toHaveCount(0);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await page.locator("html").getAttribute("data-portal")).toBeNull();
  let seen = await frames(page);
  expect(seen.length).toBeGreaterThan(0);
  expect(seen.filter((f) => f.theme !== "dark"), "image sans le Dark pendant la navigation").toEqual([]);
  expect(seen.filter((f) => !f.portal && f.sora), "image hors portail en Sora").toEqual([]);

  // Dashboard → portail : le Dark est posé dès la première image du portail (aucun éclair clair).
  await recordFrames(page);
  await switchPersona(page, "Client");
  await page.waitForURL("**/portal");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  seen = await frames(page);
  expect(seen.filter((f) => f.portal && f.theme !== "dark"), "image du portail sans le Dark").toEqual([]);
  // Le recorder a survécu : les deux trajets étaient des navigations client, pas des chargements de page.
  expect(await page.evaluate(() => typeof (window as unknown as { __frames?: unknown }).__frames)).toBe("object");
});

test("les boutons de la barre du portail font 44 px sans grandir la barre (58 px)", async ({ page }) => {
  await openPortal(page);
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    const names = width < 1280 ? ["Se déconnecter", "Ouvrir la navigation client", "Notifications"] : ["Se déconnecter", "Notifications"];
    for (const name of names) {
      const box = await page.getByRole("button", { name, exact: true }).boundingBox();
      expect(box?.height, `${name} à ${width}px`).toBeGreaterThanOrEqual(44);
      expect(box?.width, `${name} à ${width}px`).toBeGreaterThanOrEqual(44);
    }
    const bar = await page.locator("header").first().locator("> div").first().boundingBox();
    // Hauteur mesurée sur preproduction (capture de référence) : 58 px, bordures comprises.
    expect(bar?.height, `hauteur de barre à ${width}px`).toBeLessThanOrEqual(58);
  }
});

test("Sora s'applique au portail", async ({ page }) => {
  await openPortal(page);
  await expect(page.locator("html")).toHaveAttribute("data-portal", "");
  const heading = page.getByRole("heading", { level: 1 }).first();
  expect(await heading.evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/Sora/);
});
