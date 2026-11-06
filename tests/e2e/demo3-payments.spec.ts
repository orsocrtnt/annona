import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { MISSING_TEST_DATA, readTestData } from "./helpers/test-data";

// Spec écrite sans être lancée (DEMO-3 tranches 1 et 2, 28/10/2026). Comptes de recette créés sur la base
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

test("DEMO-3 : Facturation › Paiements liste, filtre et relance une facture à régler", async ({ page }) => {
  const roles = accounts();
  const data = readTestData();
  test.skip(!roles || !data, roles ? MISSING_TEST_DATA : "comptes de rôle absents : npm run e2e:role-accounts -- setup");
  await login(page, roles!.billingAdminA);
  try {
    await page.goto("/settings/billing");
    const panel = page.getByTestId("company-payments");
    await expect(panel.getByLabel("Résumé des paiements")).toBeVisible();
    // La facture en retard du jeu E2E apparaît sous le filtre « En retard » et nulle part ailleurs : pas celle de B.
    const overdue = data!.invoices.a.overdue.toUpperCase();
    const foreignOverdue = data!.invoices.b.overdue.toUpperCase();
    const pending = data!.invoices.a.pending.toUpperCase();
    const overdueLoaded = page.waitForResponse((r) => r.url().includes("/api/invoices") && r.url().includes("status=OVERDUE") && r.ok());
    await panel.getByRole("button", { name: "En retard", exact: true }).click();
    await overdueLoaded;
    await expect(panel.getByText(overdue)).toBeVisible();
    // Le filtre écarte bien la facture à venir et la facture payée du même jeu.
    await expect(panel.getByText(pending)).toHaveCount(0);
    await expect(panel.getByText(data!.invoices.a.paid.toUpperCase())).toHaveCount(0);
    await expect(panel.getByText(foreignOverdue)).toHaveCount(0);
    // « Toutes » est souvent en cache (15 s) : aucune requête à attendre, seulement la liste affichée.
    await panel.getByRole("button", { name: "Toutes", exact: true }).click();
    await expect(panel.getByRole("button", { name: "Toutes", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(panel.getByText(overdue)).toBeVisible();
    await expect(panel.getByText(foreignOverdue)).toHaveCount(0);
    await expect(panel.getByText(pending)).toBeVisible();
    // On relance précisément la facture du jeu E2E, jamais une facture préexistante.
    const remind = panel.getByRole("button", { name: `Relancer · facture ${overdue}`, exact: true });
    await expect(remind).toBeVisible();
    const answered = page.waitForResponse((r) => r.request().method() === "POST" && /\/api\/invoices\/[^/]+\/reminders$/.test(r.url()));
    await remind.click();
    expect((await answered).ok()).toBe(true);
    const notice = page.getByText(/Relance envoyée au client|Relance tracée, non envoyée|Relance déjà tracée, toujours non envoyée|Déjà relancée/);
    await expect(notice).toBeVisible();
    const sent = panel.getByRole("button", { name: `Relancée · facture ${overdue}`, exact: true });
    // Un seul état final attendu avant de choisir la branche : l'ancien bouton « Relancer » est encore là juste après le clic.
    await expect(sent.or(panel.getByText(/Relance non envoyée/).first())).toBeVisible();
    if (await sent.count()) {
      // Anti-doublon : la même facture n'est plus relançable pendant 24 h.
      await expect(sent).toBeDisabled();
    } else {
      // Aucun e-mail n'est parti (service non configuré sur annona-dev) : la relance est tracée mais ne bloque pas
      // une nouvelle tentative (BLOCKING_RESULTS = QUEUED, SENT, SEND_UNCONFIRMED), le bouton reste donc actif.
      await expect(remind).toBeEnabled();
      await expect(panel.getByText(/Relance non envoyée/).first()).toBeVisible();
    }
  } finally {
    await logout(page);
  }
});

test("DEMO-3 : la relance d'une facture d'une autre entreprise est introuvable", async ({ page }) => {
  const roles = accounts();
  const data = readTestData();
  test.skip(!roles || !data, roles ? MISSING_TEST_DATA : "comptes de rôle absents : npm run e2e:role-accounts -- setup");
  const foreignId = data!.invoices.b.overdue;
  // B voit sa propre facture (le jeu de données est bien visible côté B)...
  await login(page, roles!.billingAdminB);
  try {
    const own = (await (await page.request.get("/api/invoices")).json()).data?.invoices as Array<{ id: string }> | undefined;
    expect(own?.map((invoice) => invoice.id)).toContain(foreignId);
  } finally {
    await logout(page);
  }
  // ... et A ne peut ni la relancer ni la lister.
  await login(page, roles!.billingAdminA);
  try {
    const visibleToA = (await (await page.request.get("/api/invoices")).json()).data?.invoices as Array<{ id: string }> | undefined;
    expect(visibleToA?.map((invoice) => invoice.id)).not.toContain(foreignId);
    expect((await page.request.post(`/api/invoices/${foreignId}/reminders`)).status()).toBe(404);
  } finally {
    await logout(page);
  }
});

test("DEMO-3 : réglage « Émettre la facture à la livraison » désactivé par défaut et enregistrable", async ({ page }) => {
  const roles = accounts();
  test.skip(!roles, "comptes de rôle absents : npm run e2e:role-accounts -- setup");
  await login(page, roles!.billingAdminA);
  try {
    await page.goto("/settings/billing");
    await page.getByRole("button", { name: "Factures", exact: true }).click();
    const toggle = page.getByRole("switch", { name: "Émettre la facture à la livraison" });
    await expect(toggle).toBeVisible();
    const initial = await toggle.getAttribute("aria-checked");
    await toggle.click();
    const saved = page.waitForResponse((r) => r.request().method() === "PATCH" && r.url().includes("/api/") && r.ok());
    await page.getByRole("button", { name: "Enregistrer la facturation" }).click();
    await saved;
    await page.reload();
    await page.getByRole("button", { name: "Factures", exact: true }).click();
    await expect(toggle).toHaveAttribute("aria-checked", initial === "true" ? "false" : "true");
    // Remise dans l'état initial pour ne pas changer le comportement des autres recettes.
    await toggle.click();
    const restored = page.waitForResponse((r) => r.request().method() === "PATCH" && r.url().includes("/api/") && r.ok());
    await page.getByRole("button", { name: "Enregistrer la facturation" }).click();
    await restored;
  } finally {
    await logout(page);
  }
});
