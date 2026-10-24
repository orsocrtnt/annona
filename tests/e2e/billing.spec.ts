import { expect, test } from "@playwright/test";

test("SAAS-01B : Checkout, retour, rechargement et activation uniquement après état serveur", async ({ page }) => {
  let confirmed = false;
  const catalog = { id: "c9", code: "C9", currency: "EUR", vatRateBps: 2000, plans: [{ code: "STARTER", name: "Starter", monthlyPriceCents: 7900, annualPriceCents: 79000, includedDriverSeats: 5, unlimitedDriverSeats: false, maxDriverSeats: 10, includedAdminSeats: 1, includedDispatcherSeats: 0, includedMonthlyOrders: 1000, orderOverageUnitPriceCents: 10, includedFeatures: [] }], options: [] };
  const journey = { status: "PAYMENT_PENDING", planCode: "STARTER", billingInterval: "MONTHLY", optionSelections: [], quote: { totalHtCents: 7900, vatCents: 1580, totalTtcCents: 9480, currency: "EUR", includedMonthlyOrders: 1000, orderOverageUnitPriceCents: 10 }, email: "fixture@example.invalid", emailVerified: true, paymentConfirmed: false, activated: false, choicesEditable: false };
  await page.route("**/api/signup", async (route) => route.fulfill({ json: { catalog, journey: { ...journey, ...(confirmed ? { status: "ACTIVATED", activated: true, paymentConfirmed: true } : {}) }, paymentAdapter: "stripe-sandbox" } }));
  await page.route("**/api/signup/payment", async (route) => route.fulfill({ json: route.request().method() === "POST" ? { checkoutUrl: "https://checkout.stripe.com/test-browser-fixture" } : { confirmed } }));
  await page.route("https://checkout.stripe.com/**", async (route) => route.fulfill({ contentType: "text/html", body: "<h1>Checkout fixture — no Stripe network</h1>" }));
  await page.goto("/register?payment=return");
  await expect(page.getByRole("heading", { name: "Confirmez l’abonnement en environnement test" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Modifier l’offre" })).toBeDisabled();
  await expect(page.getByRole("heading", { name: "Votre espace est prêt" })).toHaveCount(0);
  await page.getByRole("button", { name: "Payer dans la sandbox Stripe" }).click();
  await expect(page.getByRole("heading", { name: "Checkout fixture — no Stripe network" })).toBeVisible();
  await page.goBack();
  await page.reload();
  await expect(page.getByRole("button", { name: "Payer dans la sandbox Stripe" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Votre espace est prêt" })).toHaveCount(0);
  confirmed = true;
  await expect(page.getByRole("heading", { name: "Votre espace est prêt" })).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("link", { name: "Se connecter et commencer" })).toHaveAttribute("href", "/login?redirect=/onboarding");
});

test("SAAS-01B : erreur fournisseur lisible sur mobile, inscription conservée", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/signup", (route) => route.fulfill({ json: { paymentAdapter: "stripe-sandbox", catalog: { plans: [], options: [], currency: "EUR" }, journey: { status: "PAYMENT_PENDING", planCode: "STARTER", billingInterval: "MONTHLY", optionSelections: [], emailVerified: true, activated: false, choicesEditable: false, quote: { totalHtCents: 7900, vatCents: 1580, totalTtcCents: 9480, currency: "EUR", includedMonthlyOrders: 1000, orderOverageUnitPriceCents: 10 } } } }));
  await page.route("**/api/signup/payment", (route) => route.fulfill({ status: 503, json: { error: "Le paiement sandbox est indisponible. Votre inscription est conservée." } }));
  await page.goto("/register");
  await page.getByRole("button", { name: "Payer dans la sandbox Stripe" }).click();
  await expect(page.getByText("Le paiement sandbox est indisponible. Votre inscription est conservée.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Payer dans la sandbox Stripe" })).toBeEnabled();
});
