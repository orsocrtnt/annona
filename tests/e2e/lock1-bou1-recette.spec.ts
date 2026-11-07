/**
 * Recette navigateur LOCK-1 et BOU-1 sur annona-dev (comptes de démo de `npm run db:seed`).
 * Lancer sur un serveur de dev déjà démarré (l'heure simulée du cron est refusée en production) :
 *   E2E_BASE_URL=http://localhost:3220 E2E_SKIP_WEB_SERVER=1 npx playwright test tests/e2e/lock1-bou1-recette.spec.ts
 *
 * Parcours : un client commande pour la première date encore ouverte ; le cron de verrouillage est
 * appelé avec l'heure simulée « heure limite + 1 min » ; l'admin voit les commandes du jour, corrige la
 * commande verrouillée et voit le journal ; le boulanger voit les totaux, un bon, la vue par tournée,
 * imprime, coche « préparée », signale un manquant ; l'admin voit le manquant.
 * Données d'essai : note « E2E-LOCK1 » ; commande, arrêts, tournées vides et témoin de verrouillage de
 * la date supprimés à la fin. Captures : outputs/recette-lock1-bou1/.
 */
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

type Account = { email: string; password: string };

function demoAccounts(): Record<string, Account> | null {
  try {
    return JSON.parse(readFileSync(resolve("outputs/comptes-demo.json"), "utf8")) as Record<string, Account>;
  } catch {
    return null;
  }
}

const accounts = demoAccounts();
const SHOTS = resolve("outputs/recette-lock1-bou1");
const MERCHANT_ID = "demo_merchant_01";
const MERCHANT = "Café Lumière (démo)";
const PRODUCT = "Baguette tradition";
const PRODUCT_2 = "Croissant au beurre";
const NOTE = "E2E-LOCK1 correction";
const STARTED_AT = new Date();
const DESKTOP = { width: 1440, height: 900 };
const TABLET = { width: 1024, height: 768 };
const MOBILE = { width: 390, height: 844 };

/** Jour civil à Paris, décalé de `days` jours. */
function parisDate(days: number) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
  const value = new Date(`${today}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
const parisHour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", hourCycle: "h23" }).format(new Date()));
/** Première date encore ouverte : demain avant 17h, sinon après-demain (heure limite 17:00 de la démo). */
const D = parisHour < 16 ? parisDate(1) : parisDate(2);
/** Lendemain de D, encore ouvert : total provisoire du boulanger. */
const D_OPEN = new Date(new Date(`${D}T12:00:00Z`).getTime() + 86_400_000).toISOString().slice(0, 10);
/** Instant simulé : veille de D à 17:01, heure de Paris (décalage lu par Intl). */
function simulatedCutoffPlusOne() {
  const eve = new Date(`${D}T12:00:00Z`);
  eve.setUTCDate(eve.getUTCDate() - 1);
  const day = eve.toISOString().slice(0, 10);
  const guess = new Date(`${day}T16:01:00Z`);
  const parisAtGuess = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(guess);
  const [hour, minute] = parisAtGuess.split(":").map(Number);
  return new Date(guess.getTime() - ((hour! - 17) * 60 + (minute! - 1)) * 60_000).toISOString();
}

test.describe.configure({ mode: "serial" });
test.skip(!accounts, "outputs/comptes-demo.json absent : lancer npm run db:seed sur annona-dev");

async function login(page: Page, account: Account, path: "/login" | "/login/client", home: string) {
  await page.goto(path);
  await page.locator('input[type="email"]').fill(account.email);
  await page.locator('input[name="password"]').fill(account.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL((url) => url.pathname.startsWith(home), { timeout: 60_000 });
}

let orderId = "";

async function productId(name: string) {
  const prisma = new PrismaClient();
  try {
    return (await prisma.product.findFirstOrThrow({ where: { name, companyId: "demo_company_boulangerie" }, select: { id: true } })).id;
  } finally {
    await prisma.$disconnect();
  }
}
const consoleErrors: string[] = [];

/** Erreurs de la console et de la page, relevées pour le rapport de recette. */
function watch(page: Page, label: string) {
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(`${label} : ${message.text().slice(0, 300)}`);
  });
  page.on("pageerror", (error) => consoleErrors.push(`${label} (exception) : ${error.message.slice(0, 300)}`));
}

/** Capture depuis le haut de page (évite les éléments fixes décalés d'une capture pleine page défilée). */
async function shot(page: Page, name: string, fullPage = false) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage });
}

test.beforeAll(async () => {
  mkdirSync(SHOTS, { recursive: true });
  const prisma = new PrismaClient();
  try {
    const existing = await prisma.order.count({
      where: { merchantId: MERCHANT_ID, deliveryDate: { in: [new Date(`${D}T00:00:00.000Z`), new Date(`${D_OPEN}T00:00:00.000Z`)] } },
    });
    if (existing > 0) throw new Error(`Le client de démo a déjà une commande le ${D} ou le ${D_OPEN} : recette impossible sans écraser une donnée.`);
  } finally {
    await prisma.$disconnect();
  }
});

test.afterAll(async () => {
  const prisma = new PrismaClient();
  try {
    const date = new Date(`${D}T00:00:00.000Z`);
    const orders = await prisma.order.findMany({
      where: { merchantId: MERCHANT_ID, deliveryDate: { in: [date, new Date(`${D_OPEN}T00:00:00.000Z`)] }, createdAt: { gte: STARTED_AT } },
      select: { id: true },
    });
    const ids = orders.map((order) => order.id);
    await prisma.auditLog.deleteMany({ where: { entityType: "Order", entityId: { in: ids } } });
    await prisma.order.deleteMany({ where: { id: { in: ids } } });
    // Tournées de D devenues vides et témoin du verrouillage simulé : la vraie heure limite reverrouillera.
    const rounds = await prisma.round.findMany({ where: { date, createdAt: { gte: STARTED_AT } }, select: { id: true, _count: { select: { stops: true } } } });
    await prisma.round.deleteMany({ where: { id: { in: rounds.filter((round) => round._count.stops === 0).map((round) => round.id) } } });
    await prisma.auditLog.deleteMany({ where: { entityType: "DeliveryDay", entityId: D, createdAt: { gte: STARTED_AT } } });
    const left = await prisma.order.count({ where: { id: { in: ids } } });
    console.log(`Erreurs console relevées : ${consoleErrors.length}`);
    for (const error of consoleErrors) console.log(`  - ${error}`);
    console.log(`Nettoyage E2E-LOCK1 : ${ids.length} commande(s) supprimée(s), restantes ${left}`);
  } finally {
    await prisma.$disconnect();
  }
});

test("LOCK-1 : le client commande avant l'heure limite, puis la commande est verrouillée par le cron", async ({ browser, request }) => {
  test.setTimeout(240_000);
  const context = await browser.newContext({ viewport: MOBILE, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  watch(page, "client");
  await login(page, accounts!["client-1"]!, "/login/client", "/portal");
  await expect(page.getByRole("heading", { name: "Commander" })).toBeVisible();
  await page.locator("#order-other-date").fill(D);
  await page.getByRole("radio", { name: "7h – 8h" }).click();
  await page.getByLabel("Rechercher un produit").fill(PRODUCT);
  await page.getByLabel(`Quantité de ${PRODUCT}`).fill("12");
  await page.getByLabel("Rechercher un produit").fill(PRODUCT_2);
  await page.getByLabel(`Quantité de ${PRODUCT_2}`).fill("6");
  await page.getByLabel("Rechercher un produit").fill("");
  await page.getByRole("button", { name: "Voir le panier" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Valider la commande" }).click();
  await page.waitForURL(/\/portal\/orders\/[^/?]+/);
  orderId = new URL(page.url()).pathname.split("/").pop()!;
  await expect(page.getByText("Validée", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Modifier" })).toBeVisible();
  await shot(page, "lock1-01-client-validee-mobile");

  // Deuxième commande, le lendemain de D, laissée ouverte (total provisoire du boulanger).
  const slots = (await (await page.request.get(`/api/portal/catalog`)).json()) as { data: { slots: Array<{ id: string; label: string }> } };
  const openOrder = await page.request.put("/api/portal/orders", {
    data: { deliveryDate: D_OPEN, slotId: slots.data.slots.find((slot) => slot.label === "7h – 8h")!.id, lines: [{ productId: await productId(PRODUCT), quantity: 7 }] },
  });
  expect(openOrder.status()).toBe(201);

  // Déclenchement : route cron sécurisée, heure simulée (refusée en production).
  const refused = await request.get("/api/cron/lock-orders", { headers: { Authorization: "Bearer faux" } });
  expect(refused.status()).toBe(401);
  const now = simulatedCutoffPlusOne();
  const response = await request.get(`/api/cron/lock-orders?now=${encodeURIComponent(now)}`, {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    timeout: 120_000,
  });
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { data: { results: Array<{ date: string; ordersLocked: number; roundsCreated: number }> } };
  const result = body.data.results.find((entry) => entry.date === D);
  expect(result?.ordersLocked).toBeGreaterThanOrEqual(1);
  expect(result?.roundsCreated).toBeGreaterThanOrEqual(1);
  // Deuxième appel : rien de plus (idempotent, date déjà traitée).
  const again = await request.get(`/api/cron/lock-orders?now=${encodeURIComponent(now)}`, { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } });
  expect(((await again.json()) as { data: { results: Array<{ date: string }> } }).data.results.some((entry) => entry.date === D)).toBe(false);

  await page.reload();
  await expect(page.getByText("Verrouillée", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Modifier" })).toHaveCount(0);
  await shot(page, "lock1-02-client-verrouillee-mobile");
  await context.close();
});

test("LOCK-1 : l'admin voit les commandes du jour, corrige la commande verrouillée et voit le journal", async ({ browser }) => {
  test.setTimeout(180_000);
  const context = await browser.newContext({ viewport: DESKTOP });
  const page = await context.newPage();
  watch(page, "admin");
  await login(page, accounts!.admin!, "/login", "/dashboard");
  await page.goto(`/dashboard/orders?date=${D}`);
  await expect(page.getByRole("heading", { name: "Commandes" })).toBeVisible();
  await expect(page.getByTestId("day-lock-state")).toContainText("commandes verrouillées");
  const row = page.locator("tr", { hasText: MERCHANT });
  await expect(row).toContainText("Verrouillée");
  await expect(row).toContainText("Tournée 7h – 8h");
  await shot(page, "lock1-03-admin-commandes-du-jour", true);

  // Filtres client et tournée (ADM-04).
  await page.getByRole("combobox", { name: "Client" }).click();
  await page.getByRole("option", { name: MERCHANT }).click();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByRole("combobox", { name: "Tournée" }).click();
  await page.getByRole("option", { name: /Tournée 7h – 8h/ }).first().click();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await shot(page, "lock1-04-admin-filtres");

  // Correction après l'heure limite (ADM-05), journalisée (RG-10).
  await row.getByRole("link").click();
  await page.waitForURL(new RegExp(`/dashboard/orders/${orderId}`));
  await expect(page.getByText("Heure limite passée : la commande est verrouillée pour le client.")).toBeVisible();
  await page.getByLabel(`Quantité de ${PRODUCT}`).fill("10");
  await page.getByLabel("Motif (facultatif)").fill(NOTE);
  await page.getByRole("button", { name: "Enregistrer la correction" }).click();
  await expect(page.getByText("Correction enregistrée et journalisée")).toBeVisible();
  const entry = page.getByTestId("order-history-entry").first();
  await expect(entry).toContainText(`${PRODUCT} : 12 → 10`);
  await expect(entry).toContainText("après l'heure limite");
  await expect(entry).toContainText(`Motif : ${NOTE}`);
  await shot(page, "lock1-05-admin-correction-journal", true);
  await context.close();
});

test("BOU-1 : le boulanger voit les totaux, un bon, la vue par tournée, imprime, prépare et signale un manquant", async ({ browser }) => {
  test.setTimeout(240_000);
  const context = await browser.newContext({ viewport: TABLET, hasTouch: true });
  const page = await context.newPage();
  watch(page, "boulanger");
  await page.addInitScript(() => {
    window.print = () => {};
  });
  await login(page, accounts!.boulanger!, "/login", "/bakery");

  // Date encore ouverte : total provisoire clairement marqué.
  await page.goto(`/bakery?date=${D_OPEN}`);
  await expect(page.getByTestId("production-state")).toContainText("Commandes ouvertes");
  await expect(page.getByText("Total provisoire")).toBeVisible();
  await expect(page.getByTestId(`total-${PRODUCT}`)).toContainText("7");
  await shot(page, "bou1-01-provisoire-tablette");

  // Date verrouillée : total à produire = somme des commandes verrouillées (critère 5).
  await page.goto(`/bakery?date=${D}`);
  await expect(page.getByTestId("production-state")).toContainText("verrouillées");
  await expect(page.getByTestId(`total-${PRODUCT}`)).toContainText("10");
  await expect(page.getByTestId(`total-${PRODUCT_2}`)).toContainText("6");
  await shot(page, "bou1-02-totaux-tablette", true);

  // Bon de préparation (BOU-02), manquant (BOU-06), préparée (BOU-05).
  await page.getByRole("tab", { name: "Par client" }).click();
  const sheet = page.getByTestId(`sheet-${MERCHANT}`);
  await expect(sheet).toContainText(PRODUCT);
  await shot(page, "bou1-03-bon-preparation-tablette", true);
  await sheet.getByRole("button", { name: `Signaler un manquant sur ${PRODUCT}` }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Livré").fill("8");
  await shot(page, "bou1-04-manquant-tablette");
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Manquant enregistré")).toBeVisible();
  await expect(sheet.getByTestId(`sheet-line-${PRODUCT}`)).toContainText("8 / 10");
  const [prepared] = await Promise.all([
    page.waitForResponse((response) => response.url().includes("/prepared") && response.request().method() === "POST"),
    sheet.getByRole("button", { name: "Marquer préparée" }).click(),
  ]);
  expect(prepared.status()).toBe(200);
  await expect(sheet.getByRole("button", { name: "Préparée", exact: true })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Préparée", exact: true })).toHaveAttribute("aria-pressed", "true");
  await shot(page, "bou1-05-preparee-manquant-tablette", true);

  // Vue par tournée dans l'ordre de chargement (BOU-03).
  await page.getByRole("tab", { name: "Par tournée" }).click();
  await expect(page.getByText("Ordre de chargement")).toBeVisible();
  await expect(page.getByTestId(/loading-Tournée 7h – 8h/).first()).toContainText(MERCHANT);
  await shot(page, "bou1-06-tournees-chargement-tablette", true);

  // Impression (BOU-04) : bons puis étiquettes, aperçu « print » et PDF A4.
  await page.getByRole("tab", { name: "Par client" }).click();
  await sheet.getByLabel(`Nombre de colis pour ${MERCHANT}`).fill("2");
  await page.getByRole("button", { name: "Imprimer les bons" }).click();
  await page.emulateMedia({ media: "print" });
  await expect(page.getByTestId("print-root")).toHaveAttribute("data-kind", "sheets");
  await expect(page.getByTestId("print-root")).toBeVisible();
  await shot(page, "bou1-07-impression-bons", true);
  await page.pdf({ path: `${SHOTS}/bou1-07-impression-bons.pdf`, format: "A4", printBackground: true });
  await page.emulateMedia({ media: "screen" });
  await page.getByRole("button", { name: "Imprimer les étiquettes" }).click();
  await page.emulateMedia({ media: "print" });
  await expect(page.getByTestId("print-root")).toHaveAttribute("data-kind", "labels");
  await expect(page.getByTestId("print-root")).toContainText("Colis 2/2");
  await shot(page, "bou1-08-impression-etiquettes", true);
  await page.pdf({ path: `${SHOTS}/bou1-08-impression-etiquettes.pdf`, format: "A4", printBackground: true });
  await page.emulateMedia({ media: "screen" });
  await context.close();
});

test("BOU-1 : l'admin voit le manquant ; le boulanger n'ouvre pas le back-office", async ({ browser }) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({ viewport: DESKTOP });
  const page = await context.newPage();
  watch(page, "admin (manquant)");
  await login(page, accounts!.admin!, "/login", "/dashboard");
  await page.goto(`/dashboard/orders?date=${D}`);
  const row = page.locator("tr", { hasText: MERCHANT });
  await expect(row).toContainText("Manquant");
  await expect(row).toContainText("Préparée");
  await row.getByRole("link").click();
  await expect(page.getByTestId("order-history-entry").filter({ hasText: `${PRODUCT} : 8 livrés sur 10` })).toContainText("Bastien Fournier");
  await expect(page.getByTestId(`admin-line-${PRODUCT}`)).toContainText("Manquant");
  await shot(page, "bou1-09-admin-voit-manquant", true);
  await context.close();

  // Droits : le boulanger est renvoyé vers son espace, et l'API admin le refuse.
  const baker = await browser.newContext({ viewport: TABLET });
  const bakerPage = await baker.newPage();
  await login(bakerPage, accounts!.boulanger!, "/login", "/bakery");
  await bakerPage.goto(`/dashboard/orders?date=${D}`);
  await bakerPage.waitForURL((url) => url.pathname.startsWith("/bakery"));
  const api = await bakerPage.request.patch(`/api/orders/${orderId}`, { data: { lines: [{ productId: "x", quantity: 1 }] } });
  expect(api.status()).toBe(403);
  await baker.close();

  // Le client et le livreur n'ont pas accès à la production.
  const client = await browser.newContext();
  const clientPage = await client.newPage();
  await login(clientPage, accounts!["client-1"]!, "/login/client", "/portal");
  expect((await clientPage.request.get(`/api/production?date=${D}`)).status()).toBe(403);
  await client.close();
});
