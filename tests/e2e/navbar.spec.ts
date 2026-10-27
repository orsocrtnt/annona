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
