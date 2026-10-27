test("la barre Apple reste identique dans le portail client, du bureau au mobile", async ({
  page,
}) => {
  const login = await page.request.post("/api/auth/login", {
    data: {
      email: "demo@tutelliv.fr",
      password: "Demo2026!",
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
  await expect(header.locator("a", { hasText: "TutelLiv" })).toBeVisible();

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
import { expect, test } from "@playwright/test";

test("la navigation publique reproduit le soulignement lumineux au survol", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const nav = page.getByRole("navigation", { name: "Navigation publique" });
  const pricingLink = nav.getByRole("link", { name: "Tarifs" });
  const underline = pricingLink.locator("span[aria-hidden]").first();

  await expect(nav).toBeVisible();
  await expect(underline).toHaveCSS("opacity", "0");

  await pricingLink.hover();

  await expect(pricingLink).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(underline).toHaveCSS("opacity", "1");
  await expect(underline).not.toHaveCSS("transform", "matrix(0, 0, 0, 1, 0, 0)");
  await page.screenshot({ path: testInfo.outputPath("navbar-hover.png") });
});
