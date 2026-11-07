/**
 * Recette navigateur FACT-1 sur annona-dev (comptes de démo de `npm run db:seed`) : factures par période
 * (CLI-10, ADM-10, RG-06, RG-07, ENF-05, critère 9).
 * Lancer sur un serveur de dev déjà démarré (le paramètre de recette du cron de verrouillage est refusé en production) :
 *   E2E_BASE_URL=http://localhost:3240 E2E_SKIP_WEB_SERVER=1 npx playwright test tests/e2e/fact1-recette.spec.ts
 *
 * Données d'essai préfixées « E2E-FACT1 » : un créneau inactif, deux commerces facturés chaque jour et leur
 * commande du jour (heure de Paris), menées jusqu'à « livrée » par les routes existantes : verrouillage (cron,
 * prix figés), manquant signalé et « préparée » par le boulanger, tournée attribuée et validée par l'admin,
 * « Livré » par le livreur. Parcours cliqué : l'admin génère la facture du jour depuis le back-office, vérifie
 * le montant réduit par le manquant (critère 9), ouvre le PDF et le Factur-X, renvoie l'e-mail (échec propre
 * sans clé Resend), enregistre un règlement partiel puis le solde ; le client (390 px) voit et télécharge sa
 * facture et le relevé mensuel. Deux générations simultanées pour l'autre commerce ne créent qu'une facture.
 *
 * Le compte client de démo n°1 est rattaché le temps de la recette au commerce d'essai, puis rendu à son
 * commerce. Tout est supprimé à la fin (vérifié) et le compteur de numérotation est ramené au dernier numéro
 * restant : aucun trou dans la suite des factures de la base de dev. Captures et PDF : outputs/recette-fact1/.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
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
const OUT = resolve("outputs/recette-fact1");
const STATE = resolve(OUT, "etat-recette.json");
const COMPANY = "demo_company_boulangerie";
const CLIENT_USER = "demo_user_client_1";
const DRIVER_ID = "demo_user_livreur_3";
const DRIVER_NAME = "Yanis Livreur";
const TAG = "E2E-FACT1";
const STARTED_AT = new Date();
const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };
/** Jour civil à Paris : livraison du jour, facture journalière du jour. */
const D = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
const DB_DATE = new Date(`${D}T00:00:00.000Z`);
const MAIN = `${TAG} Café Facture`;
const SECOND = `${TAG} Bistrot Concurrence`;
const EUROS = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const euros = (cents: number) => EUROS.format(cents / 100).replace(/\s/g, " ");
const flat = (value: string | null) => (value ?? "").replace(/\s/g, " ").trim();

test.describe.configure({ mode: "serial", timeout: 240_000 });
test.skip(!accounts, "outputs/comptes-demo.json absent : lancer npm run db:seed sur annona-dev");

const consoleErrors: string[] = [];
function watch(page: Page, label: string) {
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(`${label} : ${message.text().slice(0, 300)}`);
  });
  page.on("pageerror", (error) => consoleErrors.push(`${label} (exception) : ${error.message.slice(0, 300)}`));
}

async function shot(page: Page, name: string, fullPage = false) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage });
}

async function login(page: Page, account: Account, path: "/login" | "/login/driver", home: string) {
  await page.goto(path);
  await page.locator('input[type="email"]').fill(account.email);
  await page.locator('input[name="password"]').fill(account.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL((url) => url.pathname.startsWith(home), { timeout: 60_000 });
}

/** Appel d'une route existante depuis la page connectée (même origine, cookies de session). */
async function api(page: Page, method: string, url: string, body?: unknown) {
  return page.evaluate(
    async ([m, u, b]) => {
      const response = await fetch(u as string, {
        method: m as string,
        headers: { "Content-Type": "application/json" },
        body: b === undefined ? undefined : JSON.stringify(b),
      });
      return { status: response.status, body: await response.text() };
    },
    [method, url, body] as const
  );
}

const report: Record<string, unknown> = {};
let adminContext: BrowserContext;
let bakerContext: BrowserContext;
let driverContext: BrowserContext;
let clientContext: BrowserContext;
let admin: Page;
let baker: Page;
let driver: Page;
let client: Page;
let driverLocationExisted = false;
const ids: { main?: string; second?: string; mainOrder?: string; secondOrder?: string; invoice?: string } = {};

async function cleanup() {
  const prisma = new PrismaClient();
  try {
    const state = existsSync(STATE) ? (JSON.parse(readFileSync(STATE, "utf8")) as { clientMerchantId?: string; counterBefore?: number | null }) : {};
    const merchants = await prisma.merchant.findMany({ where: { companyId: COMPANY, name: { startsWith: TAG } }, select: { id: true } });
    const merchantIds = merchants.map((row) => row.id);
    // Compte client de démo rendu à son commerce.
    if (state.clientMerchantId) {
      await prisma.user.updateMany({ where: { id: CLIENT_USER, merchantId: { in: merchantIds } }, data: { merchantId: state.clientMerchantId } });
    }
    const invoices = await prisma.invoice.findMany({ where: { companyId: COMPANY, merchantId: { in: merchantIds } }, select: { id: true, number: true } });
    const invoiceIds = invoices.map((row) => row.id);
    const slot = await prisma.slot.findFirst({ where: { companyId: COMPANY, label: TAG } });
    const orders = await prisma.order.findMany({ where: { companyId: COMPANY, merchantId: { in: merchantIds } }, select: { id: true } });
    const orderIds = orders.map((row) => row.id);
    const rounds = slot ? await prisma.round.findMany({ where: { companyId: COMPANY, slotId: slot.id }, select: { id: true } }) : [];
    const jobPrefixes = [...invoiceIds.map((id) => `client-notification:invoice-email:${id}:`), ...rounds.map((round) => `driver-round:${round.id}:`)];
    if (invoiceIds.length) await prisma.invoiceReminder.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
    if (jobPrefixes.length) await prisma.operationJob.deleteMany({ where: { OR: jobPrefixes.map((prefix) => ({ jobKey: { startsWith: prefix } })) } });
    await prisma.auditLog.deleteMany({ where: { companyId: COMPANY, entityType: "Invoice", entityId: { in: invoiceIds } } });
    // Lignes et règlements suivent la facture (cascade) ; les commandes perdent leur rattachement (SET NULL).
    await prisma.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
    await prisma.stop.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.round.deleteMany({ where: { id: { in: rounds.map((row) => row.id) } } });
    await prisma.auditLog.deleteMany({ where: { companyId: COMPANY, entityType: "Order", entityId: { in: orderIds } } });
    await prisma.orderLine.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.merchant.deleteMany({ where: { id: { in: merchantIds } } });
    if (slot) await prisma.slot.delete({ where: { id: slot.id } });
    await prisma.auditLog.deleteMany({ where: { companyId: COMPANY, entityType: { in: ["RoundDay", "DeliveryDay"] }, entityId: D, createdAt: { gte: STARTED_AT } } });
    if (!driverLocationExisted) await prisma.driverLocation.deleteMany({ where: { driverId: DRIVER_ID } });

    // Numérotation continue : les numéros des factures d'essai étaient les derniers ; le compteur revient au
    // plus grand numéro restant (ou disparaît s'il n'en reste aucun), jamais en dessous d'un numéro émis.
    if (invoices.length) {
      const remaining = await prisma.invoice.aggregate({ where: { companyId: COMPANY }, _max: { number: true } });
      const max = remaining._max.number ?? 0;
      const counter = await prisma.invoiceCounter.findUnique({ where: { companyId: COMPANY } });
      const testNumbers = new Set(invoices.map((row) => row.number));
      const onlyTestAbove = counter ? Array.from({ length: counter.lastNumber - max }, (_, i) => max + 1 + i).every((n) => testNumbers.has(n)) : false;
      if (counter && counter.lastNumber > max && onlyTestAbove) {
        if (max === 0 && (state.counterBefore ?? null) === null) await prisma.invoiceCounter.delete({ where: { companyId: COMPANY } });
        else await prisma.invoiceCounter.update({ where: { companyId: COMPANY }, data: { lastNumber: max } });
      }
      report.counterReset = { removedNumbers: [...testNumbers].sort((a, b) => a - b), counterBefore: state.counterBefore ?? null, maxRemaining: max };
    }
  } finally {
    await prisma.$disconnect();
  }
}

test.beforeAll(async ({ browser }: { browser: Browser }) => {
  mkdirSync(OUT, { recursive: true });
  await cleanup();
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: CLIENT_USER }, select: { merchantId: true } });
    const counter = await prisma.invoiceCounter.findUnique({ where: { companyId: COMPANY } });
    writeFileSync(STATE, JSON.stringify({ clientMerchantId: user.merchantId, counterBefore: counter?.lastNumber ?? null }));
    report.counterBefore = counter?.lastNumber ?? null;
    driverLocationExisted = (await prisma.driverLocation.count({ where: { driverId: DRIVER_ID } })) > 0;
    const busy = await prisma.round.count({ where: { companyId: COMPANY, date: DB_DATE, driverId: DRIVER_ID } });
    if (busy > 0) throw new Error(`Le livreur ${DRIVER_ID} a déjà une tournée le ${D}.`);

    const slot = await prisma.slot.create({ data: { companyId: COMPANY, label: TAG, startTime: "04:00", endTime: "04:45", active: false, sortOrder: 98 } });
    const products = await prisma.product.findMany({ where: { companyId: COMPANY, name: { in: ["Baguette tradition", "Croissant au beurre"] } }, select: { id: true, name: true } });
    expect(products).toHaveLength(2);
    const byName = new Map(products.map((product) => [product.name, product.id]));
    for (const [index, name] of [MAIN, SECOND].entries()) {
      const merchant = await prisma.merchant.create({
        data: {
          companyId: COMPANY,
          name,
          address: `${index + 1} rue de la Facture`,
          postalCode: "75011",
          city: "Paris",
          latitude: 48.86 + index / 100,
          longitude: 2.37,
          billingPeriod: "DAILY",
          paymentMethod: "VIREMENT",
          billingEmail: `e2e-fact1-${index + 1}@example.test`,
        },
      });
      const order = await prisma.order.create({
        data: {
          companyId: COMPANY,
          reference: `${TAG}-${index + 1}`,
          merchantId: merchant.id,
          deliveryDate: DB_DATE,
          slotId: slot.id,
          status: "VALIDATED",
          validatedAt: new Date(),
          notes: TAG,
          lines: {
            create: [
              { companyId: COMPANY, productId: byName.get("Baguette tradition")!, quantityOrdered: 40 },
              { companyId: COMPANY, productId: byName.get("Croissant au beurre")!, quantityOrdered: 20 },
            ],
          },
        },
      });
      if (index === 0) {
        ids.main = merchant.id;
        ids.mainOrder = order.id;
      } else {
        ids.second = merchant.id;
        ids.secondOrder = order.id;
      }
    }
    // Le compte client de démo n°1 représente le commerce d'essai pendant la recette.
    await prisma.user.update({ where: { id: CLIENT_USER }, data: { merchantId: ids.main } });
  } finally {
    await prisma.$disconnect();
  }
  adminContext = await browser.newContext({ viewport: DESKTOP });
  bakerContext = await browser.newContext({ viewport: DESKTOP });
  driverContext = await browser.newContext({ viewport: MOBILE, hasTouch: true, isMobile: true });
  clientContext = await browser.newContext({ viewport: MOBILE, hasTouch: true, isMobile: true });
  admin = await adminContext.newPage();
  baker = await bakerContext.newPage();
  driver = await driverContext.newPage();
  client = await clientContext.newPage();
  watch(admin, "admin");
  watch(baker, "boulanger");
  watch(driver, "livreur");
  watch(client, "client");
});

test.afterAll(async () => {
  for (const context of [adminContext, bakerContext, driverContext, clientContext]) await context?.close();
  await cleanup();
  const prisma = new PrismaClient();
  try {
    const left = {
      merchants: await prisma.merchant.count({ where: { companyId: COMPANY, name: { startsWith: TAG } } }),
      orders: await prisma.order.count({ where: { companyId: COMPANY, reference: { startsWith: TAG } } }),
      invoices: await prisma.invoice.count({ where: { companyId: COMPANY, merchant: { name: { startsWith: TAG } } } }),
      slots: await prisma.slot.count({ where: { companyId: COMPANY, label: TAG } }),
      roundsOfDriver: await prisma.round.count({ where: { companyId: COMPANY, date: DB_DATE, driverId: DRIVER_ID } }),
      invoiceJobs: await prisma.operationJob.count({ where: { companyId: COMPANY, jobKey: { contains: "invoice-email" }, createdAt: { gte: STARTED_AT } } }),
      clientMerchant: (await prisma.user.findUniqueOrThrow({ where: { id: CLIENT_USER }, select: { merchantId: true } })).merchantId,
    };
    const state = JSON.parse(readFileSync(STATE, "utf8")) as { clientMerchantId: string; counterBefore: number | null };
    const counter = await prisma.invoiceCounter.findUnique({ where: { companyId: COMPANY } });
    const max = (await prisma.invoice.aggregate({ where: { companyId: COMPANY }, _max: { number: true } }))._max.number ?? 0;
    report.leftovers = { ...left, counter: counter?.lastNumber ?? null, maxInvoiceNumber: max };
    expect(left).toEqual({ merchants: 0, orders: 0, invoices: 0, slots: 0, roundsOfDriver: 0, invoiceJobs: 0, clientMerchant: state.clientMerchantId });
    // Aucun trou : le compteur égale le plus grand numéro restant (ou son état d'avant la recette).
    expect(counter?.lastNumber ?? null).toBe(max === 0 ? state.counterBefore : max);
  } finally {
    await prisma.$disconnect();
  }
  report.consoleErrors = consoleErrors;
  writeFileSync(resolve(OUT, "rapport.json"), JSON.stringify(report, null, 2));
  console.log(`[FACT-1] rapport ${JSON.stringify(report)}`);
});

test("Préparation : verrouillage (prix figés), manquant du boulanger, « préparée », tournée validée, « Livré »", async ({ request }) => {
  const lock = await request.get(`/api/cron/lock-orders?date=${D}&now=${encodeURIComponent(new Date().toISOString())}`, {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  expect(lock.status()).toBe(200);
  const prisma = new PrismaClient();
  try {
    const lines = await prisma.orderLine.findMany({ where: { orderId: { in: [ids.mainOrder!, ids.secondOrder!] } }, include: { product: { select: { name: true } } } });
    expect(lines.every((line) => line.unitPriceFrozenCents !== null)).toBe(true);
    const croissant = lines.find((line) => line.orderId === ids.mainOrder && line.product.name === "Croissant au beurre")!;

    await login(baker, accounts!.boulanger!, "/login", "/bakery");
    // BOU-06 : 6 croissants manquants (14 livrés sur 20) sur la commande du commerce principal.
    expect((await api(baker, "POST", `/api/production/lines/${croissant.id}/shortage`, { quantityDelivered: 14 })).status).toBe(200);
    for (const orderId of [ids.mainOrder!, ids.secondOrder!]) {
      expect((await api(baker, "POST", `/api/production/orders/${orderId}/prepared`, { prepared: true })).status).toBe(200);
    }

    const slot = await prisma.slot.findFirstOrThrow({ where: { companyId: COMPANY, label: TAG } });
    const round = await prisma.round.findFirstOrThrow({ where: { companyId: COMPANY, slotId: slot.id } });
    await login(admin, accounts!.admin!, "/login", "/dashboard");
    expect((await api(admin, "PATCH", `/api/rounds/${round.id}`, { driverId: DRIVER_ID })).status).toBe(200);
    expect((await api(admin, "POST", "/api/rounds/validate", { date: D })).status).toBe(200);

    await login(driver, accounts!["livreur-3"]!, "/login/driver", "/driver");
    expect((await api(driver, "POST", `/api/driver/rounds/${round.id}/start`, {})).status).toBe(200);
    const stops = await prisma.stop.findMany({ where: { roundId: round.id }, orderBy: { sequence: "asc" } });
    for (const stop of stops) expect((await api(driver, "POST", `/api/driver/stops/${stop.id}/delivered`, {})).status).toBe(200);
    const orders = await prisma.order.findMany({ where: { id: { in: [ids.mainOrder!, ids.secondOrder!] } }, select: { status: true } });
    expect(orders.map((order) => order.status)).toEqual(["DELIVERED", "DELIVERED"]);
    report.prepared = { driver: DRIVER_NAME, stops: stops.length };
  } finally {
    await prisma.$disconnect();
  }
});

/** Montant attendu (critère 9) : quantités livrées × prix figés, TVA par taux arrondie au centime. */
async function expectedTotals(orderId: string) {
  const prisma = new PrismaClient();
  try {
    const lines = await prisma.orderLine.findMany({ where: { orderId }, include: { product: { select: { vatRateBasisPoints: true, name: true } } } });
    const byRate = new Map<number, number>();
    let ordered = 0;
    for (const line of lines) {
      const total = (line.quantityDelivered ?? line.quantityOrdered) * line.unitPriceFrozenCents!;
      ordered += line.quantityOrdered * line.unitPriceFrozenCents!;
      byRate.set(line.product.vatRateBasisPoints, (byRate.get(line.product.vatRateBasisPoints) ?? 0) + total);
    }
    const subtotal = [...byRate.values()].reduce((a, b) => a + b, 0);
    const vat = [...byRate.entries()].reduce((sum, [rate, base]) => sum + Math.round((base * rate) / 10_000), 0);
    return { subtotal, vat, total: subtotal + vat, orderedSubtotal: ordered, lines };
  } finally {
    await prisma.$disconnect();
  }
}

test("ADM-10, critère 9 : l'admin génère la facture du jour ; le manquant réduit le montant", async () => {
  await admin.goto("/dashboard/invoices");
  await expect(admin.getByRole("heading", { name: "Factures" })).toBeVisible();
  await expect(admin.getByTestId("legal-gaps")).toBeVisible();
  report.legalGaps = await admin.getByTestId("legal-gaps").locator("li").allTextContents();
  await admin.getByTestId("open-generate").click();
  const dialog = admin.getByRole("dialog");
  await dialog.getByRole("combobox", { name: "Périodicité" }).click();
  await admin.getByRole("option", { name: "Jour", exact: true }).click();
  await dialog.getByLabel("Jour compris dans la période").fill(D);
  await dialog.getByRole("combobox", { name: "Client" }).click();
  await admin.getByRole("option", { name: MAIN }).click();
  await expect(dialog.getByTestId("generate-period-label")).toContainText("Période :");
  await shot(admin, "fact1-admin-generer");
  await dialog.getByRole("button", { name: "Générer les factures" }).click();
  await expect(dialog.getByTestId("generate-result")).toContainText("1 facture créée");
  await shot(admin, "fact1-admin-generee");

  // Relancer la même génération : aucun doublon.
  await dialog.getByRole("button", { name: "Générer les factures" }).click();
  await expect(dialog.getByTestId("generate-result")).toContainText("Aucune facture à créer");
  await dialog.getByRole("button", { name: "Fermer" }).first().click();

  const prisma = new PrismaClient();
  try {
    const invoice = await prisma.invoice.findFirstOrThrow({ where: { companyId: COMPANY, merchantId: ids.main } });
    ids.invoice = invoice.id;
    const expected = await expectedTotals(ids.mainOrder!);
    expect(invoice.subtotalCents).toBe(expected.subtotal);
    expect(invoice.totalCents).toBe(expected.total);
    expect(expected.subtotal).toBeLessThan(expected.orderedSubtotal);
    const croissantPrice = expected.lines.find((line) => line.product.name === "Croissant au beurre")!.unitPriceFrozenCents!;
    expect(expected.orderedSubtotal - expected.subtotal).toBe(6 * croissantPrice);
    report.critere9 = { reference: invoice.reference, orderedHT: expected.orderedSubtotal, invoicedHT: invoice.subtotalCents, ttc: invoice.totalCents, missing: "6 croissants" };

    await admin.goto("/dashboard/invoices");
    await admin.getByTestId(`invoice-row-${invoice.reference}`).getByRole("link", { name: invoice.reference }).click();
    await expect(admin.getByTestId("invoice-reference")).toHaveText(invoice.reference);
    expect(flat(await admin.getByTestId("invoice-total").textContent())).toBe(euros(expected.total));
    await expect(admin.getByTestId("invoice-line-Croissant au beurre")).toContainText("14");
    await expect(admin.getByTestId(`invoice-order-${TAG}-1`)).toContainText("Manquant");
    await shot(admin, "fact1-admin-fiche", true);
  } finally {
    await prisma.$disconnect();
  }
});

test("ENF-05 : PDF de facture et Factur-X téléchargés ; e-mail : échec propre sans service configuré, puis « Renvoyer »", async () => {
  const pdf = await adminContext.request.get(`/api/invoices/${ids.invoice}/pdf`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  writeFileSync(resolve(OUT, "facture.pdf"), await pdf.body());
  // Le bouton « PDF » ouvre le document dans un nouvel onglet (le navigateur sans interface le télécharge).
  await expect(admin.getByTestId("invoice-pdf")).toHaveAttribute("href", `/api/invoices/${ids.invoice}/pdf`);
  await expect(admin.getByTestId("invoice-pdf")).toHaveAttribute("target", "_blank");
  const [popup] = await Promise.all([admin.waitForEvent("popup"), admin.getByTestId("invoice-pdf").click()]);
  await popup.close().catch(() => undefined);

  const facturx = await adminContext.request.get(`/api/invoices/${ids.invoice}/pdf?format=facturx`);
  report.facturx = { status: facturx.status() };
  if (facturx.status() === 200) writeFileSync(resolve(OUT, "facture-facturx.pdf"), await facturx.body());
  else {
    // Démo : mentions légales incomplètes → refus lisible, champ par champ (jamais de donnée inventée).
    expect(facturx.status()).toBe(422);
    const text = await facturx.text();
    writeFileSync(resolve(OUT, "facturx-refus.txt"), text);
    expect(text).toContain("SIREN");
  }

  const status = admin.getByTestId("invoice-email-status");
  await expect(status).toContainText("Non envoyée : l'envoi d'e-mails n'est pas configuré", { timeout: 60_000 });
  await admin.getByTestId("invoice-send").click();
  await expect(admin.getByText("Envoi demandé")).toBeVisible();
  const prisma = new PrismaClient();
  try {
    await expect
      .poll(async () => (await prisma.operationJob.findMany({ where: { jobKey: { startsWith: `client-notification:invoice-email:${ids.invoice}:` } }, select: { jobKey: true, status: true, lastError: true } })).map((job) => `${job.jobKey.split(":").pop()}:${job.status}:${job.lastError}`).sort())
      .toEqual(["1:SUCCEEDED:SKIPPED:INVOICE_EMAIL_DISABLED:disabled", "2:SUCCEEDED:SKIPPED:INVOICE_EMAIL_DISABLED:disabled"]);
  } finally {
    await prisma.$disconnect();
  }
  await admin.reload();
  await expect(status).toContainText("Non envoyée");
  report.email = "2 tentatives, ignorées proprement (EMAIL_DELIVERY_MODE=disabled), relançables";
});

test("RG-07 : règlement partiel puis solde ; statut à régler → partiellement réglée → réglée", async () => {
  const prisma = new PrismaClient();
  try {
    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: ids.invoice! } });
    const form = admin.getByRole("form", { name: "Enregistrer un règlement" });
    await form.getByLabel("Montant (€)").fill("10,00");
    await form.getByLabel(/Référence/).fill(`${TAG}-VIR-1`);
    await form.getByRole("button", { name: "Enregistrer" }).click();
    await expect(admin.getByText("Règlement enregistré")).toBeVisible();
    await expect(admin.locator("header").getByText("Partiellement réglée")).toBeVisible();
    expect(flat(await admin.getByTestId("invoice-remaining").textContent())).toBe(euros(invoice.totalCents - 1000));
    await shot(admin, "fact1-admin-reglement-partiel", true);

    await form.getByRole("button", { name: "Solde" }).click();
    await form.getByRole("combobox", { name: "Mode" }).click();
    await admin.getByRole("option", { name: "Espèces" }).click();
    await form.getByRole("button", { name: "Enregistrer" }).click();
    await expect(admin.locator("header").getByText("Réglée", { exact: true })).toBeVisible();
    expect(flat(await admin.getByTestId("invoice-remaining").textContent())).toBe(euros(0));
    await expect(admin.getByTestId("invoice-payments").locator("li")).toHaveCount(2);
    await shot(admin, "fact1-admin-reglee", true);
    const after = await prisma.invoice.findUniqueOrThrow({ where: { id: ids.invoice! }, include: { payments: true } });
    expect(after.status).toBe("PAID");
    expect(after.payments.map((payment) => payment.method).sort()).toEqual(["ESPECES", "VIREMENT"]);
    report.payments = after.payments.map((payment) => ({ amountCents: payment.amountCents, method: payment.method, reference: payment.note }));

    // PDF réglé conservé pour relecture.
    const paidPdf = await adminContext.request.get(`/api/invoices/${ids.invoice}/pdf`);
    writeFileSync(resolve(OUT, "facture-reglee.pdf"), await paidPdf.body());

    // Une commande facturée ne se corrige plus : refus explicite côté serveur et message sur la fiche commande.
    const refused = await api(admin, "PATCH", `/api/orders/${ids.mainOrder}`, { lines: [{ productId: (await prisma.orderLine.findFirstOrThrow({ where: { orderId: ids.mainOrder! } })).productId, quantity: 1 }] });
    expect(refused.status).toBe(409);
    expect(refused.body).toContain("déjà facturée");
    await admin.goto(`/dashboard/orders/${ids.mainOrder}`);
    await expect(admin.getByText(/Commande déjà facturée/)).toBeVisible();
  } finally {
    await prisma.$disconnect();
  }
});

test("ENF-05 : numérotation continue — deux générations simultanées ne créent qu'une facture", async () => {
  const body = { periodType: "DAILY", date: D, merchantId: ids.second };
  const [first, second] = await Promise.all([api(admin, "POST", "/api/invoices/generate", body), api(admin, "POST", "/api/invoices/generate", body)]);
  expect([first.status, second.status]).toEqual([200, 200]);
  const created = [first, second].map((row) => (JSON.parse(row.body) as { data: { created: unknown[] } }).data.created.length);
  expect(created.sort()).toEqual([0, 1]);
  const prisma = new PrismaClient();
  try {
    const numbers = (await prisma.invoice.findMany({ where: { companyId: COMPANY }, select: { number: true }, orderBy: { number: "asc" } })).map((row) => row.number);
    expect(numbers).toEqual(Array.from({ length: numbers.length }, (_, i) => i + 1));
    expect((await prisma.order.findUniqueOrThrow({ where: { id: ids.secondOrder! } })).invoiceId).not.toBeNull();
    report.concurrency = { created, numbers };
  } finally {
    await prisma.$disconnect();
  }
});

test("CLI-10 : le client (390 px) voit et télécharge sa facture et le relevé mensuel, pas celle d'un autre", async () => {
  await login(client, accounts!["client-1"]!, "/login", "/portal");
  await client.goto(`/portal/invoices?type=DAILY&date=${D}`);
  const prisma = new PrismaClient();
  try {
    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: ids.invoice! } });
    const card = client.getByTestId(`portal-invoice-${invoice.reference}`);
    await expect(card).toBeVisible();
    await expect(card).toContainText("Réglée");
    await expect(client.getByTestId(/^portal-invoice-FAC/)).toHaveCount(1);
    await shot(client, "fact1-client-jour", true);
    const pdf = await clientContext.request.get(`/api/portal/invoices/${invoice.id}/pdf`);
    expect(pdf.status()).toBe(200);
    writeFileSync(resolve(OUT, "facture-portail.pdf"), await pdf.body());
    await expect(card.getByTestId(`portal-invoice-pdf-${invoice.reference}`)).toHaveAttribute("href", `/api/portal/invoices/${invoice.id}/pdf`);

    // Relevé mensuel : onglet « Mensuel », puis « Relevé PDF ».
    await client.getByRole("tab", { name: "Mensuel" }).click();
    await client.waitForURL(/type=MONTHLY/);
    await expect(client.getByTestId("portal-period-label")).toHaveText(/^[A-ZÉ][a-zéû]+ \d{4}$/);
    await expect(client.getByTestId("portal-statement")).toHaveAttribute("href", /periodType=MONTHLY/);
    await expect(card).toBeVisible();
    await shot(client, "fact1-client-mois", true);
    const statementHref = (await client.getByTestId("portal-statement").getAttribute("href"))!;
    expect(statementHref).toContain("periodType=MONTHLY");
    const statement = await clientContext.request.get(statementHref);
    expect(statement.status()).toBe(200);
    expect(statement.headers()["content-type"]).toBe("application/pdf");
    writeFileSync(resolve(OUT, "releve-mensuel.pdf"), await statement.body());

    // Isolation : la facture de l'autre commerce d'essai est introuvable pour ce client.
    const other = await prisma.invoice.findFirstOrThrow({ where: { companyId: COMPANY, merchantId: ids.second } });
    expect((await clientContext.request.get(`/api/portal/invoices/${other.id}/pdf`)).status()).toBe(404);
    // Le back-office des factures est refusé au client.
    expect((await api(client, "GET", "/api/invoices")).status).toBe(403);
  } finally {
    await prisma.$disconnect();
  }
  // Boulanger et livreur : pas d'accès aux factures.
  expect((await api(baker, "GET", "/api/invoices")).status).toBe(403);
  expect((await api(driver, "GET", "/api/invoices")).status).toBe(403);
});
