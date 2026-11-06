/**
 * Recette navigateur CAT-1 et CMD-1 sur annona-dev (comptes de démo de `npm run db:seed`).
 * Lancer sur un serveur déjà démarré :
 *   E2E_BASE_URL=http://localhost:3210 E2E_SKIP_WEB_SERVER=1 npx playwright test tests/e2e/cat1-cmd1-recette.spec.ts
 * Données créées préfixées « E2E-CAT1 » et supprimées à la fin. Captures : outputs/recette-cmd1/.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";

type Account = { email: string; password: string };

function demoAccounts(): Record<string, Account> | null {
  try {
    return JSON.parse(readFileSync(resolve("outputs/comptes-demo.json"), "utf8")) as Record<string, Account>;
  } catch {
    return null;
  }
}

const accounts = demoAccounts();
const SHOTS = resolve("outputs/recette-cmd1");
const PREFIX = "E2E-CAT1";
const RUN = Date.now().toString(36);
const CATEGORY = `${PREFIX} Catégorie ${RUN}`;
const PRODUCT = `${PREFIX} Fougasse ${RUN}`;
const MERCHANT_A = "Café Lumière (démo)";
const STARTED_AT = new Date();
/** Commandes créées par la recette (supprimées à la fin). */
const createdOrderIds = new Set<string>();

/** Jour civil à Paris, décalé de `days` jours. */
function parisDate(days: number) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
  const value = new Date(`${today}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
const D1 = parisDate(20);
const D2 = parisDate(21);
const MOBILE = { width: 390, height: 844 };

test.describe.configure({ mode: "serial" });
test.skip(!accounts, "outputs/comptes-demo.json absent : lancer npm run db:seed sur annona-dev");

async function login(page: Page, account: Account, path: "/login" | "/login/client", home: string) {
  await page.goto(path);
  await page.locator('input[type="email"]').fill(account.email);
  await page.locator('input[name="password"]').fill(account.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL((url) => url.pathname.startsWith(home), { timeout: 60_000 });
}

test.beforeAll(() => mkdirSync(SHOTS, { recursive: true }));

test.afterAll(async () => {
  const prisma = new PrismaClient();
  try {
    await prisma.order.deleteMany({ where: { id: { in: [...createdOrderIds] } } });
    await prisma.recurringOrder.deleteMany({ where: { merchantId: "demo_merchant_01", createdAt: { gte: STARTED_AT } } });
    const products = await prisma.product.findMany({ where: { name: { startsWith: PREFIX } }, select: { id: true } });
    const productIds = products.map((product) => product.id);
    await prisma.orderLine.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.recurringOrderLine.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.merchantPrice.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.category.deleteMany({ where: { name: { startsWith: PREFIX } } });
  } finally {
    await prisma.$disconnect();
  }
});

test("CAT-1 : l'administrateur crée une catégorie, un produit avec photo et un prix spécifique", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page, accounts!.admin!, "/login", "/dashboard");
  await page.goto("/dashboard/catalog");
  await expect(page.getByRole("heading", { name: "Catalogue" })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/cat1-01-catalogue-desktop.png`, fullPage: false });

  // Catégorie : création, montée d'un rang, désactivation puis réactivation.
  await page.getByPlaceholder("Nouvelle catégorie").fill(CATEGORY);
  await page.getByRole("button", { name: "Nouvelle catégorie" }).click();
  const row = page.getByTestId(`category-row-${CATEGORY}`);
  await expect(row).toBeVisible();
  await page.getByRole("button", { name: `Monter ${CATEGORY}` }).click();
  const toggle = page.getByRole("switch", { name: `Désactiver ${CATEGORY}` });
  await toggle.click();
  await expect(row.getByText("Désactivée")).toBeVisible();
  await page.getByRole("switch", { name: `Activer ${CATEGORY}` }).click();
  await expect(row.getByText("Désactivée")).toHaveCount(0);
  await row.getByRole("button", { name: new RegExp(CATEGORY) }).first().click();

  // Produit : création dans la catégorie choisie, unité libre, prix de base 2,40 €.
  await page.getByRole("button", { name: "Nouveau produit" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nom", { exact: false }).first().fill(PRODUCT);
  await dialog.getByLabel("Unité de vente").fill("plaque de 6");
  await dialog.getByLabel("Prix de base HT (€)").fill("2,40");
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await expect(dialog.getByRole("heading", { name: "Modifier le produit" })).toBeVisible();

  // Photo envoyée dans Supabase Storage puis affichée par l'API.
  const png = await sharp({ create: { width: 320, height: 240, channels: 3, background: { r: 214, g: 170, b: 110 } } }).png().toBuffer();
  await dialog.getByTestId("product-photo-input").setInputFiles({ name: "fougasse.png", mimeType: "image/png", buffer: png });
  await expect(page.getByText("Photo enregistrée")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Remplacer la photo" })).toBeVisible();

  // Prix spécifique pour le client A (1,90 €).
  await dialog.getByRole("combobox", { name: "Client" }).click();
  await page.getByRole("option", { name: MERCHANT_A }).click();
  await dialog.getByLabel("Prix HT (€)").fill("1,90");
  await dialog.getByRole("button", { name: "Ajouter le prix" }).click();
  await expect(dialog.getByTestId("specific-price-list")).toContainText(MERCHANT_A);
  await expect(dialog.getByTestId("specific-price-list")).toContainText("1,90");
  await page.screenshot({ path: `${SHOTS}/cat1-02-fiche-produit-desktop.png` });
  await page.keyboard.press("Escape");

  const productRow = page.getByTestId(`product-row-${PRODUCT}`);
  await expect(productRow).toContainText("2,40");
  await expect(productRow).toContainText("1 client");
  await expect(productRow.locator("img")).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/cat1-03-liste-produits-desktop.png` });
});

function orderIdFromUrl(page: Page) {
  const id = new URL(page.url()).pathname.split("/").pop()!;
  createdOrderIds.add(id);
  return id;
}

test("CAT-1 critère 3 : le client A voit son prix spécifique, le client B le prix de base", async ({ browser }) => {
  test.setTimeout(180_000);
  for (const [key, price, specific] of [["client-1", "1,90", true], ["client-2", "2,40", false]] as const) {
    const context = await browser.newContext({ viewport: MOBILE, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    await login(page, accounts![key]!, "/login/client", "/portal");
    await page.getByLabel("Rechercher un produit").fill(PRODUCT);
    const row = page.getByTestId(`portal-product-${PRODUCT}`);
    await expect(row.getByTestId("portal-product-price")).toContainText(price);
    await expect(row.getByText("Votre prix")).toHaveCount(specific ? 1 : 0);
    await page.screenshot({ path: `${SHOTS}/cmd1-01-prix-${key}-mobile.png` });
    await context.close();
  }
});

test("CMD-1 : commande (+ / −, saisie, date, créneau), modification, recommander chronométré, annulation, récurrente, droits", async ({ browser }) => {
  test.setTimeout(300_000);
  const context = await browser.newContext({ viewport: MOBILE, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await login(page, accounts!["client-1"]!, "/login/client", "/portal");
  await expect(page.getByRole("heading", { name: "Commander" })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/cmd1-02-commander-mobile.png` });

  // Date et créneau (RG-02, RG-08) : date lointaine sans commande existante, créneau 7h – 8h.
  await page.locator("#order-other-date").fill(D1);
  await page.getByRole("radio", { name: "7h – 8h" }).click();
  await expect(page.getByTestId("existing-order-banner")).toHaveCount(0);

  // + / − et saisie directe (CLI-04).
  await page.getByLabel("Rechercher un produit").fill(PRODUCT);
  for (let i = 0; i < 3; i += 1) await page.getByRole("button", { name: `Ajouter un ${PRODUCT}` }).click();
  await page.getByRole("button", { name: `Retirer un ${PRODUCT}` }).click();
  await expect(page.getByLabel(`Quantité de ${PRODUCT}`)).toHaveValue("2");
  await page.getByLabel("Rechercher un produit").fill("Baguette tradition");
  await page.getByLabel("Quantité de Baguette tradition").fill("12");
  await page.getByLabel("Rechercher un produit").fill("");
  await expect(page.getByTestId("cart-bar")).toContainText("14 articles");
  await page.screenshot({ path: `${SHOTS}/cmd1-03-catalogue-quantites-mobile.png` });

  // Panier récapitulatif modifiable, puis validation (statut VALIDATED).
  await page.getByRole("button", { name: "Voir le panier" }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByTestId(`cart-line-${PRODUCT}`)).toContainText("1,90");
  await page.screenshot({ path: `${SHOTS}/cmd1-04-panier-mobile.png` });
  await sheet.getByRole("button", { name: "Valider la commande" }).click();
  await page.waitForURL(/\/portal\/orders\/[^/?]+/);
  const firstId = orderIdFromUrl(page);
  await expect(page.getByText("Validée", { exact: true })).toBeVisible();
  await expect(page.getByTestId(`order-line-${PRODUCT}`)).toContainText("× 2");
  await page.screenshot({ path: `${SHOTS}/cmd1-05-commande-validee-mobile.png` });

  // Modification jusqu'à l'heure limite (CLI-06) : la même commande est rouverte.
  await page.getByRole("button", { name: "Modifier" }).click();
  await page.waitForURL((url) => url.pathname === "/portal");
  await expect(page.getByTestId("existing-order-banner")).toBeVisible();
  await page.getByLabel("Rechercher un produit").fill(PRODUCT);
  await page.getByLabel(`Quantité de ${PRODUCT}`).fill("5");
  await page.getByRole("button", { name: "Voir le panier" }).click();
  await page.screenshot({ path: `${SHOTS}/cmd1-06-modification-mobile.png` });
  await page.getByRole("dialog").getByRole("button", { name: "Enregistrer les modifications" }).click();
  await page.waitForURL(new RegExp(`/portal/orders/${firstId}`));
  await expect(page.getByTestId(`order-line-${PRODUCT}`)).toContainText("× 5");

  // Droits : le client B ne lit pas la commande du client A (404) ; refus serveur d'une date du jour.
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await login(otherPage, accounts!["client-2"]!, "/login/client", "/portal");
  expect((await otherPage.request.get(`/api/portal/orders/${firstId}`)).status()).toBe(404);
  expect((await otherPage.request.post(`/api/portal/orders/${firstId}/cancel`)).status()).toBe(404);
  await other.close();
  const today = await page.request.put("/api/portal/orders", {
    data: { deliveryDate: parisDate(0), slotId: "demo_slot_0700", lines: [{ productId: "demo_product_001", quantity: 1 }] },
  });
  expect(today.status()).toBe(400);

  // Critère 1 (ENF-03) : recopier une commande de l'historique et la valider, chronométré.
  await page.goto("/portal");
  await expect(page.getByRole("heading", { name: "Commander" })).toBeVisible();
  const started = Date.now();
  await page.getByRole("link", { name: "Recommander" }).click();
  await page.waitForURL(/\/portal\/orders\?tab=history/);
  const firstHistory = page.locator("[data-testid^=order-card-]").first();
  await firstHistory.getByRole("button", { name: "Recommander" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByTestId("reorder-summary")).toContainText("produits");
  await dialog.locator("#reorder-other-date").fill(D2);
  await page.screenshot({ path: `${SHOTS}/cmd1-07-recommander-mobile.png` });
  await dialog.getByRole("button", { name: "Valider la commande" }).click();
  await page.waitForURL(/\/portal\/orders\/[^/?]+\?saved=1/);
  await expect(page.getByText("Validée", { exact: true })).toBeVisible();
  const elapsedMs = Date.now() - started;
  const reorderedId = orderIdFromUrl(page);
  writeFileSync(`${SHOTS}/chrono-critere-1.json`, JSON.stringify({ elapsedMs, at: new Date().toISOString(), steps: ["Recommander (Commander)", "Recommander (1re commande de l'historique)", "date", "Valider la commande"] }, null, 2));
  console.log(`[critère 1] recopie validée en ${(elapsedMs / 1000).toFixed(1)} s`);
  expect(elapsedMs).toBeLessThan(60_000);
  await page.screenshot({ path: `${SHOTS}/cmd1-08-recopie-validee-mobile.png` });

  // État voisin : recopier une seconde fois vers la même date et le même créneau → commande existante proposée.
  await page.goto("/portal/orders?tab=history");
  await page.locator("[data-testid^=order-card-]").first().getByRole("button", { name: "Recommander" }).click();
  await page.getByRole("dialog").locator("#reorder-other-date").fill(D2);
  await page.getByRole("dialog").getByRole("button", { name: "Valider la commande" }).click();
  await expect(page.getByRole("dialog").getByText("Une commande existe déjà")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Ouvrir la commande existante" }).click();
  await page.waitForURL(new RegExp(`/portal/orders/${reorderedId}`));

  // Annulation avant l'heure limite (CLI-06).
  await page.goto(`/portal/orders/${firstId}`);
  await page.getByRole("button", { name: "Annuler la commande" }).click();
  await page.getByRole("button", { name: "Annuler la commande" }).last().click();
  await expect(page.getByText("Annulée", { exact: true })).toBeVisible();

  // Commande récurrente (CLI-09) depuis une commande : jours, créneau, suspension, suppression.
  await page.goto(`/portal/orders/${reorderedId}`);
  await page.getByRole("link", { name: "En faire une commande récurrente" }).click();
  const editor = page.getByRole("dialog");
  await expect(editor.getByRole("heading", { name: "Nouvelle commande récurrente" })).toBeVisible();
  await editor.getByRole("button", { name: "dimanche" }).click();
  await page.screenshot({ path: `${SHOTS}/cmd1-09-recurrente-editeur-mobile.png` });
  await editor.getByRole("button", { name: "Enregistrer" }).click();
  const card = page.getByTestId("recurring-card").last();
  await expect(card).toContainText("Lun, Mar, Mer, Jeu, Ven, Sam");
  await card.getByRole("switch").click();
  await expect(card.getByText("Suspendue").first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/cmd1-10-recurrente-mobile.png` });
  page.once("dialog", (dialogEvent) => dialogEvent.accept());
  await card.getByRole("button", { name: "Supprimer" }).click();

  // Profil (CLI-02).
  await page.goto("/portal/profile");
  await expect(page.getByTestId("merchant-profile")).toContainText(MERCHANT_A);
  await page.screenshot({ path: `${SHOTS}/cmd1-11-profil-mobile.png`, fullPage: true });
  await context.close();
});
