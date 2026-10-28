import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

// Deux administrateurs de deux entreprises de recette avec compte Stripe de test, créés sur la base
// de développement par `npm run e2e:role-accounts -- setup`.
type Account = { email: string; password: string };
type History = Array<{ label: string; occurredAt: string; documentUrl?: string }>;
const accounts = (): Record<"billingAdminA" | "billingAdminB", Account> | null => {
  try {
    return JSON.parse(readFileSync(resolve("outputs/e2e-role-accounts.json"), "utf8"));
  } catch {
    return null;
  }
};

const as = async <T>(page: Page, account: Account, run: () => Promise<T>) => {
  expect((await page.request.post("/api/auth/login", { data: { ...account, accountType: "company" } })).status()).toBe(200);
  try {
    return await run();
  } finally {
    await page.request.post("/api/auth/logout").catch(() => undefined);
  }
};
const history = async (page: Page) => {
  const response = await page.request.get("/api/billing/subscription");
  expect(response.status()).toBe(200);
  return ((await response.json()).data?.history ?? []) as History;
};
const invoiceUrls = (entries: History) => new Set(entries.flatMap((entry) => (entry.documentUrl ? [entry.documentUrl] : [])));
const portalSince = (entries: History, since: number) =>
  entries.filter((entry) => entry.label === "Accès au moyen de paiement" && Date.parse(entry.occurredAt) >= since).length;

test("SAAS-03 : isolement A/B, factures, portail et journal propres à l'entreprise de session", async ({ page }) => {
  test.setTimeout(180_000);
  const roles = accounts();
  test.skip(!roles, "comptes de rôle absents : npm run e2e:role-accounts -- setup");
  const since = Date.now() - 2_000;

  const before = await as(page, roles!.billingAdminB, () => history(page));

  const a = await as(page, roles!.billingAdminA, async () => {
    // Aucun identifiant de compte, d'abonnement ou d'entreprise n'est accepté : le compte vient de la session.
    expect((await page.request.post("/api/billing", { data: { action: "portal", accountId: "autre" } })).status()).toBe(400);
    expect((await page.request.post("/api/billing", { data: { action: "portal", companyId: "autre" } })).status()).toBe(400);
    const portal = await page.request.post("/api/billing", { data: { action: "portal" } });
    expect(portal.status()).toBe(200);
    expect(JSON.stringify(await portal.json())).toContain("https://billing.stripe.com/");
    const entries = await history(page);
    expect(portalSince(entries, since)).toBeGreaterThan(0);

    await page.goto("/settings/subscription");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    return entries;
  });

  await as(page, roles!.billingAdminB, async () => {
    const after = await history(page);
    // L'ouverture du portail par A n'apparaît pas dans le journal de B.
    expect(portalSince(after, since)).toBe(portalSince(before, since));
    const mine = invoiceUrls(after);
    for (const url of invoiceUrls(a)) expect(mine.has(url), "facture de A visible par B").toBe(false);

    await page.goto("/settings/subscription");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const shown = await page.locator('a[href^="https://invoice.stripe.com/"]').evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    for (const url of shown) expect(invoiceUrls(a).has(url!), "lien de facture de A affiché à B").toBe(false);
  });
});
