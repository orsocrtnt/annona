import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { prisma } from "../../src/services/prisma/client";
import { createAdminClient } from "../../src/services/supabase/admin";
import { DEFAULT_BILLING_SETTINGS } from "../../src/lib/validations/billing-settings";
import { DEFAULT_DISPATCH_SETTINGS } from "../../src/lib/validations/dispatch-settings";
import { activateManualPilot } from "../../src/domains/saas/saas.service";

test("ONBOARD-1 : pilote manuel, choix persistant après retour, rechargement et reconnexion", async ({ page }) => {
  // Recette écrite pour la préproduction isolée (garde ci-dessous) : sur la base de développement
  // ENV-2, elle est ignorée explicitement plutôt que d'échouer à chaque `npm run test:e2e` local.
  const devTarget = (() => {
    try {
      return JSON.parse(execFileSync(process.execPath, ["--import", "tsx", "scripts/env2/verify-dev-env.ts"], { encoding: "utf8" })).passed === true;
    } catch {
      return false; // Garde ENV-2 en échec : la cible n'est pas tutelliv-dev.
    }
  })();
  test.skip(devTarget, "ONBOARD-1 vise la préproduction isolée, pas tutelliv-dev");
  test.setTimeout(240_000);
  const isolation = JSON.parse(execFileSync(process.execPath, ["--import", "tsx", "scripts/ci/verify-preproduction-env.ts"], { encoding: "utf8" }));
  assert.equal(isolation.passed, true, "PREPRODUCTION_ISOLATION_FAILED");
  assert.equal(process.env.EMAIL_DELIVERY_MODE, "disabled", "EMAIL_MUST_BE_DISABLED");
  const startedAt = Date.now();
  const key = `onboard1-browser-${randomUUID()}`;
  const password = `Test-${randomUUID()}!Aa1`;
  const authIds: string[] = [];
  const accounts: Array<{ email: string; accountType: string }> = [];
  const supabase = createAdminClient();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const company = await prisma.company.create({ data: { name: "ONBOARD-1 navigateur", slug: key, status: "TRIAL", settings: {} } });
  try {
    await activateManualPilot({ companyId: company.id, startsAt: new Date(), endsAt: new Date(Date.now() + 86_400_000), features: [], limits: { admins: 1, drivers: 1, dispatchers: 1, monthlyOrders: 10 } });
    for (const [slug, accountType] of [["company-admin", "company"], ["client", "client"], ["driver", "driver"]] as const) {
      const role = await prisma.role.findUniqueOrThrow({ where: { slug } });
      const email = `${key}-${slug}@example.test`;
      const auth = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
      assert.ok(auth.data.user && !auth.error, "AUTH_FIXTURE_FAILED");
      authIds.push(auth.data.user.id);
      await prisma.user.create({ data: { authId: auth.data.user.id, email, firstName: "Recette", lastName: "ONBOARD-1", status: "ACTIVE", roleId: role.id, companyId: company.id, ...(slug === "company-admin" ? { settings: { onboardingRequired: true } } : {}) } });
      accounts.push({ email, accountType });
    }
    const login = async (index: number) => {
      await page.context().clearCookies();
      const response = await page.request.post("/api/auth/login", { data: { ...accounts[index], password } });
      expect(response.status()).toBe(200);
    };
    await page.context().clearCookies();
    await page.goto("/login?redirect=/dashboard");
    await page.getByRole("textbox", { name: /^Email/ }).fill(accounts[0]!.email);
    await page.getByLabel(/^Mot de passe/).fill(password);
    await page.getByRole("button", { name: "Se connecter", exact: true }).click();
    await expect(page).toHaveURL(/\/onboarding$/);

    await expect(page.getByRole("heading", { name: "Première livraison", exact: true })).toBeVisible();
    await expect(page.getByTestId("onboarding-step")).toHaveCount(9);
    await expect(page.getByText("Bon à savoir", { exact: true })).toBeVisible();
    await expect(page.getByText(/Aucun import initial n’est proposé aujourd’hui/)).toBeVisible();
    const companyForm = page.getByRole("form", { name: "Informations entreprise", exact: true });
    await companyForm.getByRole("textbox", { name: /^E-mail de l’entreprise/ }).fill("invalide");
    await companyForm.getByRole("button", { name: "Enregistrer les informations entreprise", exact: true }).click();
    expect(await companyForm.getByRole("textbox", { name: /^E-mail de l’entreprise/ }).evaluate((element: HTMLInputElement) => element.validity.valid)).toBe(false);
    await companyForm.getByRole("textbox", { name: /^E-mail de l’entreprise/ }).fill("contact@example.test");
    await companyForm.getByRole("textbox", { name: /^Adresse de l’entreprise/ }).fill("1 rue du Test");
    await companyForm.getByRole("textbox", { name: /^Ville de l’entreprise/ }).fill("Paris");
    await companyForm.getByRole("button", { name: "Enregistrer les informations entreprise", exact: true }).click();
    await expect(page.getByText("Informations entreprise enregistrées", { exact: true })).toBeVisible();
    await page.reload();
    await expect(companyForm.getByRole("textbox", { name: /^Adresse de l’entreprise/ })).toHaveValue("1 rue du Test");
    const choice = page.locator('[data-step="collaborators"]');
    await choice.getByRole("button", { name: "Passer cette étape", exact: true }).click();
    await expect(choice.getByRole("button", { name: "Reprendre cette étape", exact: true })).toBeVisible();
    await page.reload();
    await expect(choice.getByRole("button", { name: "Reprendre cette étape", exact: true })).toBeVisible();
    await choice.getByRole("link", { name: "Gérer les collaborateurs", exact: true }).click();
    await expect(page).toHaveURL(/\/users$/);
    await page.goBack();
    await expect(choice.getByRole("button", { name: "Reprendre cette étape", exact: true })).toBeVisible();
    await login(0);
    await page.goto("/onboarding");
    await expect(companyForm.getByRole("textbox", { name: /^E-mail de l’entreprise/ })).toHaveValue("contact@example.test");
    await expect(choice.getByRole("button", { name: "Reprendre cette étape", exact: true })).toBeVisible();
    const persisted = await page.request.get("/api/onboarding");
    expect((await persisted.json()).data.skippedSteps).toBe(1);
    const duplicate = await page.request.post("/api/users", { data: { email: accounts[1]!.email, firstName: "Client", lastName: "Existant", roleSlug: "client" } });
    expect(duplicate.status()).toBe(409);
    await choice.getByRole("button", { name: "Reprendre cette étape", exact: true }).click();
    await expect(choice.getByRole("button", { name: "Passer cette étape", exact: true })).toBeVisible();
    await page.reload();
    await expect(choice.getByRole("button", { name: "Passer cette étape", exact: true })).toBeVisible();
    expect((await page.request.patch("/api/onboarding", { data: { step: "firstDelivery", skipped: true } })).status()).toBe(400);
    for (const index of [1, 2]) {
      await login(index);
      expect((await page.request.get("/api/onboarding")).status()).toBe(403);
      expect((await page.request.patch("/api/onboarding", { data: { step: "collaborators", skipped: true } })).status()).toBe(403);
    }
    expect(errors).toEqual([]);
    await login(0);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/onboarding");
    await expect(choice.getByRole("button", { name: "Passer cette étape", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await mkdir(resolve("outputs/onboard1"), { recursive: true });
    await page.screenshot({ path: resolve("outputs/onboard1/pilot-mobile.png"), fullPage: true });
    expect(errors).toEqual([]);
    // État voisin : compte déjà confirmé et parcours complet, puis lecture seule.
    const client = await prisma.user.findUniqueOrThrow({ where: { email: accounts[1]!.email } });
    const driver = await prisma.user.findUniqueOrThrow({ where: { email: accounts[2]!.email } });
    await prisma.company.update({ where: { id: company.id }, data: { settings: {
      deliveryCategories: { STANDARD: true, COURIER: false, SPECIAL_MISSION: false }, billing: DEFAULT_BILLING_SETTINGS,
      dispatchRules: DEFAULT_DISPATCH_SETTINGS, onboarding: { skippedCollaborators: true },
    } } });
    const order = await prisma.order.create({ data: { reference: key, status: "DELIVERED", totalAmount: 10, companyId: company.id, customerId: client.id, customerEmail: client.email, shippingAddress: "1 rue du Test", shippingCity: "Paris", shippingPostalCode: "75001" } });
    await prisma.delivery.create({ data: { reference: key, status: "DELIVERED", address: "1 rue du Test", city: "Paris", postalCode: "75001", companyId: company.id, orderId: order.id, customerId: client.id, driverId: driver.id, driverName: "Livreur Test", completedAt: new Date(), podOutcome: "SUCCESS", podNote: "Preuve fictive", podCapturedAt: new Date() } });
    await page.context().clearCookies();
    await page.goto("/login");
    await page.getByRole("textbox", { name: /^Email/ }).fill(accounts[0]!.email);
    await page.getByLabel(/^Mot de passe/).fill(password);
    await page.getByRole("button", { name: "Se connecter", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await prisma.saasSubscription.update({ where: { companyId: company.id }, data: { status: "READ_ONLY" } });
    await login(0);
    await page.goto("/onboarding");
    await expect(companyForm.getByRole("button", { name: "Enregistrer les informations entreprise", exact: true })).toBeDisabled();
    expect((await page.request.patch("/api/onboarding", { data: { step: "collaborators", skipped: false } })).status()).toBe(403);
    expect(errors).toEqual([]);
  } finally {
    await page.context().clearCookies();
    await prisma.order.deleteMany({ where: { companyId: company.id } });
    await prisma.user.deleteMany({ where: { companyId: company.id } });
    await prisma.company.delete({ where: { id: company.id } });
    for (const id of authIds) {
      const deleted = await supabase.auth.admin.deleteUser(id);
      assert.equal(deleted.error, null, "AUTH_FIXTURE_CLEANUP_FAILED");
    }
    expect(await prisma.company.count({ where: { slug: key } })).toBe(0);
    expect(await prisma.user.count({ where: { authId: { in: authIds } } })).toBe(0);
  }
  await writeFile(resolve("outputs/onboard1/browser.json"), JSON.stringify({
    task: "ONBOARD-1-technical-pilot", passed: true, durationMs: Date.now() - startedAt,
    actions: ["signup-flag-login-redirect", "invalid-company-email-refused", "company-profile-save-reload-relogin", "skip-click", "reload", "accounts-link", "back", "relogin", "resume-click", "reload", "existing-client-refused", "mandatory-step-refused", "client-driver-denied", "mobile-no-overflow", "completed-login-dashboard", "read-only-denied"],
    fixture: "isolated-manual-pilot", residualCompanies: 0, residualUsers: 0, residualAuthUsers: 0, pageErrors: errors, realEmail: false, realPilot: false,
  }, null, 2) + "\n");
});
