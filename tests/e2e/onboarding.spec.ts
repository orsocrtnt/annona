import { expect, test } from "@playwright/test";

test("ONBOARD-1 : l'administrateur voit le chemin réel et les limites du pilote", async ({ page }) => {
  test.setTimeout(120_000);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  const login = await page.request.post("/api/auth/login", {
    data: {
      email: "demo@tutelliv.fr",
      password: "Demo2026!",
      accountType: "company",
    },
  });
  expect(login.ok()).toBeTruthy();

  await page.goto("/onboarding");
  await expect(page.getByRole("heading", { name: "Première livraison", exact: true })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Avancement de la première livraison" })).toBeVisible();
  await expect(page.getByTestId("onboarding-step")).toHaveCount(7);
  await expect(page.getByText("Limites du pilote interne", { exact: true })).toBeVisible();
  await expect(page.getByText(/Aucun import initial n’est proposé aujourd’hui/)).toBeVisible();

  const asClient = await page.request.post("/api/demo/persona", { data: { persona: "client" } });
  expect(asClient.status()).toBe(200);
  const clientDenied = await page.request.get("/api/onboarding");
  expect(clientDenied.status()).toBe(403);

  const asDriver = await page.request.post("/api/demo/persona", { data: { persona: "driver" } });
  expect(asDriver.status()).toBe(200);
  const driverDenied = await page.request.get("/api/onboarding");
  expect(driverDenied.status()).toBe(403);
  expect(pageErrors).toEqual([]);
});
