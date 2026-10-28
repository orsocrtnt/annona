import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

// Compte super-admin temporaire créé sur la base de développement par `npm run e2e:role-accounts -- setup`.
type Account = { email: string; password: string };
const accounts = (): Record<"superAdmin" | "dispatcher", Account> | null => {
  try {
    return JSON.parse(readFileSync(resolve("outputs/e2e-role-accounts.json"), "utf8"));
  } catch {
    return null;
  }
};

test("SAAS-02 : /admin affiche le revenu remboursé et net du serveur, en lecture seule, réservé au super-admin", async ({ page }) => {
  test.setTimeout(120_000);
  const roles = accounts();
  test.skip(!roles, "comptes de rôle absents : npm run e2e:role-accounts -- setup");

  expect((await page.request.post("/api/auth/login", { data: { ...roles!.dispatcher, accountType: "company" } })).status()).toBe(200);
  try {
    expect((await page.request.get("/api/admin/saas-health")).status()).toBe(403);
  } finally {
    await page.request.post("/api/auth/logout").catch(() => undefined);
  }

  expect((await page.request.post("/api/auth/login", { data: { ...roles!.superAdmin, accountType: "company" } })).status()).toBe(200);
  try {
    const response = await page.request.get("/api/admin/saas-health");
    expect(response.status()).toBe(200);
    const body = await response.json();
    const revenue = (body.data ?? body).revenue as { subscriptionPaidHtCents: number; refundedHtCents: number; netPaidHtCents: number };

    await page.goto("/admin");
    const health = page.locator("[data-saas-health-readonly=true]");
    await expect(health.getByRole("heading", { name: "Santé SaaS · lecture seule" })).toBeVisible();
    const money = (cents: number) => page.evaluate((value) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value / 100), cents);
    const card = health.locator("div").filter({ hasText: "Abonnements confirmés HT" }).last();
    await expect(card).toContainText(await money(revenue.subscriptionPaidHtCents));
    if (revenue.refundedHtCents > 0) {
      await expect(card).toContainText(`− ${await money(revenue.refundedHtCents)} remboursés, net ${await money(revenue.netPaidHtCents)}`);
    }
    // Lecture seule : aucun bouton ni champ dans la section santé.
    expect(await health.locator("button, input, select, textarea, form").count()).toBe(0);
  } finally {
    await page.request.post("/api/auth/logout").catch(() => undefined);
  }
});
