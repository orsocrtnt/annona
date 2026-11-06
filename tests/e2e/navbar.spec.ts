import { expect, test } from "@playwright/test";

// Libère l'espace du pool de démonstration réservé par la connexion du test.
test.afterEach(async ({ page }) => {
  await page.request.post("/api/auth/logout").catch(() => undefined);
});

test("la barre Apple reste identique dans le portail client, du bureau au mobile", async ({
  page,
}) => {
  const login = await page.request.post("/api/auth/login", {
    data: {
      email: "demo@annona.fr",
      password: "Demo2026!",
      demoTestSession: true,
      accountType: "company",
    },
  });
  expect(login.ok()).toBeTruthy();

  const persona = await page.request.post("/api/demo/persona", {
    data: { persona: "client" },
  });
  expect(persona.status()).toBe(200);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/portal");

  const header = page.locator("header").first();
  const desktopNav = page.getByRole("navigation", {
    name: "Navigation de l’espace client",
  });
  await expect(header).toBeVisible();
  await expect(desktopNav).toBeVisible();
  await expect(desktopNav.getByRole("link", { name: "Tableau de bord" })).toHaveAttribute(
    "aria-current",
    "page"
  );
  await expect(header.locator("a", { hasText: "Annona" })).toBeVisible();

  const frame = header.locator("div").first();
  await expect(frame).toHaveCSS("border-radius", "18px");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(desktopNav).toBeHidden();

  const menuButton = page.getByRole("button", { name: "Ouvrir la navigation client" });
  await expect(menuButton).toBeVisible();
  await menuButton.click();
  await expect(page.getByRole("menu")).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Mes commandes" })).toBeVisible();
});
