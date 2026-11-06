import { expect, test, type Page } from "@playwright/test";
import { prisma } from "../../src/services/prisma/client";

const demo = async (page: Page) => {
  expect((await page.request.post("/api/auth/login", { data: { email: "demo@annona.fr", password: "Demo2026!", demoTestSession: true, accountType: "company" } })).status()).toBe(200);
  expect((await page.request.post("/api/demo/persona", { data: { persona: "admin" } })).status()).toBe(200);
};

test.describe("téléphone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("carte : le menu s'ouvre ; thème clair seul, sans bouton de thème", async ({ page }) => {
    test.setTimeout(120_000);
    await page.addInitScript(() => window.localStorage.setItem("annona-theme", "dark"));
    await demo(page);
    await page.goto("/dispatch/map");
    const menu = page.getByRole("button", { name: "Ouvrir le menu" });
    await expect(menu).toBeVisible({ timeout: 45_000 });
    await menu.click();
    const nav = page.getByRole("dialog");
    await expect(nav.getByRole("link", { name: "Tableau de bord" })).toBeVisible();
    await nav.getByRole("link", { name: "Commandes" }).click();
    await expect(page).toHaveURL(/orders/, { timeout: 45_000 });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.getByTestId("theme-toggle")).toBeHidden();
    await page.request.post("/api/auth/logout");
  });
});

test("ordinateur : une mission en cours sélectionnée affiche son itinéraire", async ({ page }) => {
  test.setTimeout(120_000);
  await demo(page);
  const map = (await (await page.request.get("/api/dispatch/map")).json()) as { data: { deliveries?: Array<{ reference: string; status: string; driverLocation: unknown; destination: unknown }> } };
  const list = map.data.deliveries ?? (map.data as unknown as Array<{ reference: string; status: string; driverLocation: unknown; destination: unknown }>);
  const mission = list.find((d) => ["IN_DELIVERY", "PURCHASING"].includes(d.status) && d.driverLocation && d.destination);
  test.skip(!mission, "aucune mission en cours avec une position dans la démo");
  await page.goto("/dispatch/map");
  await page.getByText(mission!.reference).first().click({ timeout: 45_000 });
  await expect.poll(
    () => page.evaluate(() => [...document.querySelectorAll(".leaflet-overlay-pane path")].filter((p) => (p.getAttribute("d") ?? "").length > 40).length),
    { timeout: 30_000 }
  ).toBeGreaterThan(0);
  await page.request.post("/api/auth/logout");
});
