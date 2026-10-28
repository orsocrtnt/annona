import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

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

/** Première commande facturée (non annulée) de l'entreprise de session : la liste ne porte pas les factures, le détail oui. */
async function findInvoicedOrder(page: Page): Promise<{ orderId: string; invoiceId: string } | undefined> {
  const json = await (await page.request.get("/api/orders")).json();
  const rows = (Array.isArray(json.data) ? json.data : json.data?.items ?? []) as Array<{ id: string }>;
  for (const row of rows.slice(0, 20)) {
    const detail = await (await page.request.get(`/api/orders/${row.id}`)).json();
    const invoice = ((detail.data?.invoices ?? []) as Array<{ id: string; status: string }>).find((item) => item.status !== "CANCELLED");
    if (invoice) return { orderId: row.id, invoiceId: invoice.id };
  }
  return undefined;
}

test("FACTURX : l'administrateur voit et enregistre les mentions légales dans Réglages › Facturation", async ({ page }) => {
  const roles = accounts();
  test.skip(!roles, "comptes de rôle absents : npm run e2e:role-accounts -- setup");
  await login(page, roles!.billingAdminA);
  try {
    await page.goto("/settings/billing");
    await page.getByRole("button", { name: "Factures" }).click();
    const card = page.getByTestId("einvoicing-settings");
    await expect(card.getByText("Mentions légales et Factur-X")).toBeVisible();
    await card.getByLabel("Pénalités de retard (obligatoire)").fill("Pénalités de retard : trois fois le taux d'intérêt légal.");
    await card.getByLabel("Escompte (obligatoire)").fill("Pas d'escompte pour paiement anticipé.");
    await card.getByRole("button", { name: "Enregistrer les mentions légales" }).click();
    await expect(page.getByText(/Mentions légales enregistrées|Enregistrement impossible/)).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: "Factures" }).click();
    await expect(card.getByLabel("Escompte (obligatoire)")).toHaveValue("Pas d'escompte pour paiement anticipé.");
  } finally {
    await logout(page);
  }
});

test("FACTURX : une facture d'une autre entreprise est introuvable, en PDF classique comme en Factur-X", async ({ page }) => {
  const roles = accounts();
  test.skip(!roles, "comptes de rôle absents : npm run e2e:role-accounts -- setup");
  await login(page, roles!.billingAdminB);
  let foreignInvoiceId: string | undefined;
  try {
    foreignInvoiceId = (await findInvoicedOrder(page))?.invoiceId;
  } finally {
    await logout(page);
  }
  test.skip(!foreignInvoiceId, "aucune facture dans l'entreprise B de recette");

  await login(page, roles!.billingAdminA);
  try {
    expect((await page.request.get(`/api/invoices/${foreignInvoiceId}/pdf`)).status()).toBe(404);
    expect((await page.request.get(`/api/invoices/${foreignInvoiceId}/pdf?format=facturx`)).status()).toBe(404);
  } finally {
    await logout(page);
  }
});

test("FACTURX : depuis la commande facturée, le Factur-X se télécharge ou explique ce qui manque", async ({ page }) => {
  const roles = accounts();
  test.skip(!roles, "comptes de rôle absents : npm run e2e:role-accounts -- setup");
  await login(page, roles!.billingAdminA);
  try {
    const invoiced = await findInvoicedOrder(page);
    test.skip(!invoiced, "aucune commande facturée dans l'entreprise A de recette");
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
