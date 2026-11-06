/**
 * Recette navigateur CAT-1 et CMD-1 sur annona-dev (comptes de démo de `npm run db:seed`).
 * Lancer sur un serveur déjà démarré :
 *   E2E_BASE_URL=http://localhost:3210 E2E_SKIP_WEB_SERVER=1 npx playwright test tests/e2e/cat1-cmd1-recette.spec.ts
 * Données créées préfixées « E2E-CAT1 » et supprimées à la fin. Captures : outputs/recette-cmd1/.
 */
import { mkdirSync, readFileSync } from "node:fs";
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
