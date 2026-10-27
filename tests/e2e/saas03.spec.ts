import { expect, test } from "@playwright/test";

const subscription = {
  formula: { code: "PRO", name: "Pro" },
  billingInterval: "MONTHLY",
  period: { startsAt: "2026-10-01T00:00:00.000Z", endsAt: "2026-11-01T00:00:00.000Z" },
  premiumDiscovery: {
    endsAt: "2026-12-01T00:00:00.000Z",
    features: [
      { code: "auto_dispatch", name: "Dispatch automatique" },
      { code: "admin_gps", name: "Carte GPS administrateur" },
      { code: "client_gps", name: "Carte GPS client" },
      { code: "advanced_analytics", name: "Statistiques avancées" },
    ],
  },
  options: [{ code: "auto_dispatch", name: "Dispatch automatique", quantity: 1, unitPriceCents: 2900 }],
  usage: { usedOrders: 800, includedOrders: 1000, overageOrders: 0 },
  status: "Actif",
  alerts: [{ code: "USAGE_80", label: "80 % du forfait de commandes atteint" }],
  history: [{ type: "invoice", label: "Facture de renouvellement", status: "Payée", occurredAt: "2026-10-20T00:00:00.000Z", amountCents: 21480 }],
};

test("SAAS-03 : vue lecture seule, clic, retour, rechargement et mobile sans Stripe", async ({ page }) => {
  const requests: string[] = [];
  const login = await page.request.post("/api/auth/login", {
    data: {
      email: "demo@tutelliv.fr",
      password: "Demo2026!",
      accountType: "company",
    },
  });
  expect(login.status()).toBe(200);
  await page.route("**/api/billing/subscription", async (route) => {
    requests.push(route.request().method());
    await route.fulfill({ json: { data: subscription }, headers: { "Cache-Control": "no-store" } });
  });
  await page.route("**/api/billing", async (route) => {
    throw new Error(`API de mutation inattendue : ${route.request().method()}`);
  });
  await page.route("**/*stripe*", async (route) => {
    throw new Error(`Requête Stripe interdite : ${route.request().url()}`);
  });

  await page.goto("/dashboard");
  await page.getByRole("link", { name: "Mon abonnement" }).click();
  await expect(page).toHaveURL(/\/settings\/subscription$/);
  await expect(page.getByRole("heading", { name: "Mon abonnement" })).toBeVisible();
  await expect(page.getByText("Pro", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Découverte premium active" })).toBeVisible();
  await expect(page.getByLabel("Fonctions de la découverte premium").getByRole("listitem")).toHaveCount(4);
  await expect(page.getByText("Vos quotas et votre facturation restent inchangés.")).toBeVisible();
  await expect(page.getByText("80 % du forfait de commandes atteint")).toBeVisible();
  await expect(page.locator("[data-subscription-readonly=true] button")).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goForward();
  await page.reload();
  await expect(page.getByText("Facture de renouvellement")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("heading", { name: "Mon abonnement" })).toBeVisible();
  await expect(page.locator("[data-subscription-readonly=true]")).toBeVisible();
  expect(requests.length).toBeGreaterThanOrEqual(2);
  expect(requests.every((method) => method === "GET")).toBe(true);
});
