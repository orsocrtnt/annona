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
      demoTestSession: true,
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

test("SAAS-03 : résiliation confirmée, même clé après une erreur, puis résiliation programmée", async ({ page }) => {
  const login = await page.request.post("/api/auth/login", {
    data: { email: "demo@tutelliv.fr", password: "Demo2026!", demoTestSession: true, accountType: "company" },
  });
  expect(login.status()).toBe(200);
  let cancelled = false;
  const posts: Array<{ action: string; key: string; confirmed: boolean }> = [];
  await page.route("**/api/billing/subscription", (route) => route.fulfill({
    json: { data: { ...subscription, management: "SELF_SERVICE", canCancel: !cancelled, cancelAtPeriodEnd: cancelled } },
    headers: { "Cache-Control": "no-store" },
  }));
  await page.route("**/api/billing", async (route) => {
    posts.push(route.request().postDataJSON());
    if (posts.length === 1) return route.fulfill({ status: 409, json: { error: "Modification non appliquée ou en attente de rapprochement. Relisez l’historique avant de réessayer avec la même demande." } });
    cancelled = true;
    return route.fulfill({ json: { cancelAtPeriodEnd: true } });
  });
  await page.route("**/*stripe*", async (route) => {
    throw new Error(`Requête Stripe interdite : ${route.request().url()}`);
  });

  await page.goto("/settings/subscription");
  await page.getByRole("button", { name: "Résilier à l’échéance" }).click();
  await expect(page.getByRole("dialog", { name: "Résilier votre abonnement ?" })).toContainText("reste active jusqu’au");
  await page.getByRole("button", { name: "Garder mon abonnement" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(posts).toHaveLength(0);

  await page.getByRole("button", { name: "Résilier à l’échéance" }).click();
  await page.getByRole("button", { name: "Confirmer la résiliation" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Relisez l’historique" })).toBeVisible();
  await page.getByRole("button", { name: "Confirmer la résiliation" }).click();
  await expect(page.getByRole("heading", { name: "Résiliation programmée" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Résilier à l’échéance" })).toHaveCount(0);
  expect(posts).toHaveLength(2);
  expect(posts.every((post) => post.action === "cancel" && post.confirmed === true)).toBe(true);
  expect(posts[1]!.key).toBe(posts[0]!.key);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("heading", { name: "Résiliation programmée" })).toBeVisible();
});

test("SAAS-03 : changement de formule avec aperçu, comptes en excès bloquants, puis confirmation à la même clé", async ({ page }) => {
  const login = await page.request.post("/api/auth/login", {
    data: { email: "demo@tutelliv.fr", password: "Demo2026!", demoTestSession: true, accountType: "company" },
  });
  expect(login.status()).toBe(200);
  const plans = [
    { code: "STARTER", name: "Starter", monthlyPriceCents: 7900, annualPriceCents: 79000 },
    { code: "PRO", name: "Pro", monthlyPriceCents: 17900, annualPriceCents: 179000 },
    { code: "BUSINESS", name: "Business", monthlyPriceCents: 39900, annualPriceCents: 399000 },
  ];
  const posts: Array<Record<string, unknown>> = [];
  await page.route("**/api/billing/subscription", (route) => route.fulfill({
    json: { data: { ...subscription, management: "SELF_SERVICE", canCancel: true, canChange: true, cancelAtPeriodEnd: false } },
  }));
  await page.route("**/api/billing", async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: { plans, options: [{ code: "AUTO_DISPATCH", featureKey: "auto_dispatch", applicablePlans: ["STARTER"] }], current: { planCode: "PRO", billingInterval: "MONTHLY", selections: [{ code: "AUTO_DISPATCH", quantity: 1 }] } } });
    const body = route.request().postDataJSON() as Record<string, unknown> & { selection: { planCode: string } };
    posts.push(body);
    if (body.action === "preview" && body.selection.planCode === "STARTER") {
      return route.fulfill({ json: { totalCents: 0, currency: "EUR", timing: "renewal", prorationDate: 1793100000, quote: { totalTtcCents: 9480, billingInterval: "MONTHLY" }, assessment: { blockers: [{ resource: "drivers", current: 8, limit: 5, excess: 3 }], lostFeatures: ["advanced_analytics"], orderOverage: null } } });
    }
    if (body.action === "preview") {
      return route.fulfill({ json: { totalCents: 12345, currency: "EUR", timing: "immediate", prorationDate: 1793100000, quote: { totalTtcCents: 47880, billingInterval: "MONTHLY" }, assessment: { blockers: [], lostFeatures: [], orderOverage: null } } });
    }
    if (posts.filter((post) => post.action === "change").length === 1) return route.fulfill({ status: 409, json: { error: "Modification non appliquée ou en attente de rapprochement. Relisez l’historique avant de réessayer avec la même demande." } });
    return route.fulfill({ json: { timing: "immediate", invoiceId: "in_fixture" } });
  });
  await page.route("**/*stripe*", async (route) => {
    throw new Error(`Requête Stripe interdite : ${route.request().url()}`);
  });

  await page.goto("/settings/subscription");
  await page.getByRole("button", { name: "Changer de formule" }).click();
  const dialog = page.getByRole("dialog", { name: "Changer de formule" });
  await expect(dialog.getByRole("radio", { name: /Pro.*Formule actuelle/ })).toBeDisabled();
  await dialog.getByRole("radio", { name: /Starter/ }).click();
  await expect(dialog.getByRole("alert")).toContainText("Désactivez d’abord 3 comptes livreurs");
  await expect(dialog).toContainText("Fonctions retirées : Statistiques avancées.");
  await expect(dialog.getByRole("button", { name: "Programmer le changement" })).toBeDisabled();

  await dialog.getByRole("radio", { name: /Business/ }).click();
  await expect(dialog).toContainText("À payer aujourd’hui : 123,45 € TTC");
  await dialog.getByRole("button", { name: "Payer 123,45 € et changer" }).click();
  await expect(dialog.getByRole("alert").filter({ hasText: "Relisez l’historique" })).toBeVisible();
  await dialog.getByRole("button", { name: "Payer 123,45 € et changer" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  const changes = posts.filter((post) => post.action === "change");
  expect(changes).toHaveLength(2);
  expect(changes[1]!.key).toBe(changes[0]!.key);
  expect(changes[0]).toMatchObject({ confirmed: true, confirmedTotalCents: 12345, prorationDate: 1793100000, selection: { planCode: "BUSINESS", billingInterval: "MONTHLY", selections: [] } });
});
