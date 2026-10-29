import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

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
  test.skip(!roles, "comptes de rôle absents : npm run e2e:role-accounts -- setup");
  await login(page, roles!.billingAdminA);
  try {
    await page.goto("/settings/billing");
    const panel = page.getByTestId("company-payments");
    await expect(panel.getByLabel("Résumé des paiements")).toBeVisible();
    const overdue = page.waitForResponse((r) => r.url().includes("/api/invoices") && r.url().includes("status=OVERDUE") && r.ok());
    await panel.getByRole("button", { name: "En retard", exact: true }).click();
    await overdue;
    // « Toutes » est souvent en cache (15 s) : aucune requête à attendre, seulement la liste affichée.
    await panel.getByRole("button", { name: "Toutes", exact: true }).click();
    await expect(panel.getByRole("button", { name: "Toutes", exact: true })).toHaveAttribute("aria-pressed", "true");
    // Attendre la liste avant de compter : sinon le décompte vaut 0 et le test est toujours ignoré.
    await expect(panel.getByRole("list", { name: "Liste des paiements" }).or(panel.getByText(/Aucune facture/)).first()).toBeVisible();
    const remind = panel.getByRole("button", { name: /^Relancer · facture/ }).first();
    test.skip((await remind.count()) === 0, "aucune facture à régler relançable dans l'entreprise de test");
    const label = (await remind.getAttribute("aria-label")) ?? "";
    const reference = label.replace(/^Relancer · facture /, "");
    const answered = page.waitForResponse((r) => r.request().method() === "POST" && /\/api\/invoices\/[^/]+\/reminders$/.test(r.url()));
    await remind.click();
    expect((await answered).ok()).toBe(true);
    await expect(page.getByText(/Relance envoyée au client|Relance tracée, non envoyée|Déjà relancée|Relance déjà tracée/).first()).toBeVisible();
    // Relance partie (envoyée ou en cours) : la facture n'est plus relançable pendant 24 h.
    // Relance non partie (e-mail désactivé en développement) : « Relancer » reste actif et l'écran dit « Relance non envoyée ».
    const sent = panel.getByRole("button", { name: `Relancée · facture ${reference}` });
    const stillActive = panel.getByRole("button", { name: `Relancer · facture ${reference}` });
    // Un seul état final attendu avant de choisir la branche : l'ancien bouton « Relancer » est encore là juste après le clic.
    await expect(sent.or(panel.getByText(/Relance non envoyée/).first())).toBeVisible();
    if (await sent.count()) {
      await expect(sent).toBeDisabled();
    } else {
      await expect(stillActive).toBeEnabled();
      await expect(panel.getByText(/Relance non envoyée/).first()).toBeVisible();
    }
  } finally {
    await logout(page);
  }
});

test("DEMO-3 : la relance d'une facture d'une autre entreprise est introuvable", async ({ page }) => {
  const roles = accounts();
  test.skip(!roles, "comptes de rôle absents : npm run e2e:role-accounts -- setup");
  await login(page, roles!.billingAdminB);
  let foreignId: string | undefined;
  try {
    foreignId = ((await (await page.request.get("/api/invoices")).json()).data?.invoices?.[0]?.id) as string | undefined;
  } finally {
    await logout(page);
  }
  test.skip(!foreignId, "aucune facture dans l'entreprise B");
  await login(page, roles!.billingAdminA);
  try {
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
