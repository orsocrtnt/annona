import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { MISSING_TEST_DATA, readTestData } from "./helpers/test-data";

// Spec écrite sans être lancée (tranche Factur-X du 28/10/2026). Comptes de recette créés sur la base
// de développement par `npm run e2e:role-accounts -- setup` ; aucune donnée de production.
type Account = { email: string; password: string };
const accounts = (): Record<"billingAdminA" | "billingAdminB", Account> | null => {
  try {
    return JSON.parse(readFileSync(resolve("outputs/e2e-role-accounts.json"), "utf8"));
  } catch {
    return null;
  }
};

const login = async (page: Page, account: Account) => {
  expect((await page.request.post("/api/auth/login", { data: { ...account, accountType: "company" } })).status()).toBe(200);
};
const logout = (page: Page) => page.request.post("/api/auth/logout").catch(() => undefined);

test("FACTURX : l'administrateur voit et enregistre les mentions légales dans Réglages › Facturation", async ({ page }) => {
  test.setTimeout(120_000); // rechargement lent sur le serveur de développement
  const roles = accounts();
  test.skip(!roles, "comptes de rôle absents : npm run e2e:role-accounts -- setup");
  await login(page, roles!.billingAdminA);
  try {
    // Les valeurs chargées écrasent le formulaire à leur arrivée : on attend le GET avant de remplir.
    const loaded = page.waitForResponse((r) => r.request().method() === "GET" && r.url().includes("/api/company/einvoicing") && r.ok());
    await page.goto("/settings/billing");
    await page.getByRole("button", { name: "Factures" }).click();
    const card = page.getByTestId("einvoicing-settings");
    await expect(card.getByText("Mentions légales et Factur-X")).toBeVisible();
    await loaded;
    const penalties = card.getByLabel("Pénalités de retard (obligatoire)");
    const discount = card.getByLabel("Escompte (obligatoire)");
    const initial = { penalties: await penalties.inputValue(), discount: await discount.inputValue() };
    const save = async (values: { penalties: string; discount: string }) => {
      await penalties.fill(values.penalties);
      await discount.fill(values.discount);
      const saved = page.waitForResponse((r) => r.request().method() === "PATCH" && r.url().includes("/api/company/einvoicing") && r.status() === 200);
      await card.getByRole("button", { name: "Enregistrer les mentions légales" }).click();
      await saved;
    };
    // Valeur unique par passage : un enregistrement sans effet ne peut pas passer, et l'état initial est restauré.
    const stamp = Date.now();
    const next = { penalties: `Pénalités de retard : trois fois le taux d'intérêt légal (E2E ${stamp}).`, discount: `Pas d'escompte pour paiement anticipé (E2E ${stamp}).` };
    try {
      await save(next);
      const reloaded = page.waitForResponse((r) => r.request().method() === "GET" && r.url().includes("/api/company/einvoicing") && r.ok());
      await page.reload();
      await page.getByRole("button", { name: "Factures" }).click();
      await reloaded;
      await expect(card.getByLabel("Escompte (obligatoire)")).toHaveValue(next.discount);
    } finally {
      if (initial.penalties && initial.discount) await save(initial).catch(() => undefined);
    }
  } finally {
    await logout(page);
  }
});

test("FACTURX : une facture d'une autre entreprise est introuvable, en PDF classique comme en Factur-X", async ({ page }) => {
  const roles = accounts();
  const data = readTestData();
  test.skip(!roles || !data, roles ? MISSING_TEST_DATA : "comptes de rôle absents : npm run e2e:role-accounts -- setup");
  await login(page, roles!.billingAdminB);
  let foreignInvoiceId: string | undefined;
  try {
    foreignInvoiceId = data!.invoices.b.overdue;
    // B obtient sa propre facture : le 404 de A ci-dessous prouve donc l'isolation, pas une facture inexistante.
    expect((await page.request.get(`/api/invoices/${foreignInvoiceId}/pdf`)).status()).toBe(200);
  } finally {
    await logout(page);
  }

  await login(page, roles!.billingAdminA);
  try {
    expect((await page.request.get(`/api/invoices/${foreignInvoiceId}/pdf`)).status()).toBe(404);
    expect((await page.request.get(`/api/invoices/${foreignInvoiceId}/pdf?format=facturx`)).status()).toBe(404);
  } finally {
    await logout(page);
  }
});

test("FACTURX : depuis la commande facturée, le Factur-X se télécharge ou explique ce qui manque", async ({ page }) => {
  test.setTimeout(120_000); // première compilation de la fiche commande sur le serveur de développement
  const roles = accounts();
  const data = readTestData();
  test.skip(!roles || !data, roles ? MISSING_TEST_DATA : "comptes de rôle absents : npm run e2e:role-accounts -- setup");
  await login(page, roles!.billingAdminA);
  try {
    const invoiced = { orderId: data!.invoices.a.orderId };
    await page.goto(`/dashboard/orders/${invoiced!.orderId}`);
    const links = page.getByTestId("invoice-downloads");
    await expect(links.getByRole("link", { name: /Factur-X/ })).toBeVisible();
    const href = await links.getByRole("link", { name: /Factur-X/ }).getAttribute("href");
    const response = await page.request.get(href!);
    expect([200, 422]).toContain(response.status());
    if (response.status() === 200) {
      expect(response.headers()["content-type"]).toContain("application/pdf");
      const body = Buffer.from(await response.body()).toString("latin1");
      expect(body).toContain("/AFRelationship /Data");
      expect(body).toContain("factur-x.xml");
    } else {
      expect(await response.text()).toContain("Le PDF classique de la facture reste téléchargeable.");
    }
  } finally {
    await logout(page);
  }
});
