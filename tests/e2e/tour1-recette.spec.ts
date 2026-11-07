/**
 * Recette navigateur TOUR-1 sur annona-dev (comptes de démo de `npm run db:seed`), critères 6, 7 et 8.
 * Lancer sur un serveur de dev déjà démarré (les paramètres de recette du cron sont refusés en production) :
 *   E2E_BASE_URL=http://localhost:3230 E2E_SKIP_WEB_SERVER=1 npx playwright test tests/e2e/tour1-recette.spec.ts
 *
 * Données d'essai préfixées « E2E-TOUR1 » : un créneau inactif, quatre commerces et leurs commandes du jour
 * (heure de Paris), verrouillées par le cron (`?date=` force la date) qui calcule la tournée. Parcours :
 * l'admin crée une tournée, déplace un arrêt de l'une à l'autre, attribue les tournées et les valide ; le
 * livreur (390 px) voit l'ordre, la liste de chargement ; l'admin réordonne et le livreur voit le nouvel
 * ordre (critère 6) ; il démarre, marque « Livré », ouvre l'arrêt suivant dans Plans en deux appuis
 * (critère 7), signale un problème avec photo ; hors réseau il marque « Livré » (indicateur en attente),
 * puis au retour du réseau l'admin voit l'arrêt livré (critère 8) et l'incident dans le suivi.
 * Tout est supprimé à la fin (vérifié). Captures : outputs/recette-tour1/.
 */
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
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
const SHOTS = resolve("outputs/recette-tour1");
const COMPANY = "demo_company_boulangerie";
const DRIVER_ID = "demo_user_livreur_1";
const DRIVER_NAME = "Mathis Livreur";
const DRIVER_2_NAME = "Lina Livreur";
const TAG = "E2E-TOUR1";
const STARTED_AT = new Date();
const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };
/** Jour civil à Paris : la tournée du livreur est celle du jour. */
const D = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
const DB_DATE = new Date(`${D}T00:00:00.000Z`);
const ROUND_A = `Tournée ${TAG}`;
const ROUND_B = `Tournée ${TAG} · B`;
const MERCHANTS = [
  { key: "alpha", name: `${TAG} Café Alpha`, latitude: 48.8566, longitude: 2.3794, access: "Code 1234, porte de service" },
  { key: "beta", name: `${TAG} Bistrot Beta`, latitude: 48.8619, longitude: 2.3644, access: null },
  { key: "gamma", name: `${TAG} Épicerie Gamma`, latitude: 48.8498, longitude: 2.3912, access: null },
  { key: "delta", name: `${TAG} Hôtel Delta`, latitude: 48.8682, longitude: 2.3801, access: "Sonner à la réception" },
];

// Base distante : en développement, chaque requête met plusieurs secondes (base à Paris, poste éloigné).
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
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage });
}

async function login(page: Page, account: Account, path: "/login" | "/login/driver", home: string) {
  await page.goto(path);
  await page.locator('input[type="email"]').fill(account.email);
  await page.locator('input[name="password"]').fill(account.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL((url) => url.pathname.startsWith(home), { timeout: 60_000 });
}

let slotId = "";
let driverLocationExisted = false;
let adminContext: BrowserContext;
let driverContext: BrowserContext;
let admin: Page;
let driver: Page;
const report: Record<string, unknown> = {};

async function e2eStops(prisma: PrismaClient) {
  const rounds = await prisma.round.findMany({ where: { companyId: COMPANY, slotId }, select: { id: true, name: true } });
  const stops = await prisma.stop.findMany({
    where: { roundId: { in: rounds.map((round) => round.id) } },
    select: { id: true, roundId: true, sequence: true, status: true, deliveredAt: true, incidentCode: true, incidentPhotoPath: true, order: { select: { merchant: { select: { name: true } } } } },
    orderBy: [{ roundId: "asc" }, { sequence: "asc" }],
  });
  return { rounds, stops };
}

async function cleanup() {
  const prisma = new PrismaClient();
  try {
    const slot = await prisma.slot.findFirst({ where: { companyId: COMPANY, label: TAG } });
    const merchants = await prisma.merchant.findMany({ where: { companyId: COMPANY, name: { startsWith: TAG } }, select: { id: true } });
    const orders = await prisma.order.findMany({ where: { companyId: COMPANY, merchantId: { in: merchants.map((row) => row.id) } }, select: { id: true } });
    const rounds = slot ? await prisma.round.findMany({ where: { companyId: COMPANY, slotId: slot.id }, select: { id: true } }) : [];
    const stops = await prisma.stop.findMany({ where: { orderId: { in: orders.map((row) => row.id) } }, select: { id: true, incidentPhotoPath: true } });
    const photos = stops.map((row) => row.incidentPhotoPath).filter((path): path is string => Boolean(path));
    if (photos.length > 0 && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      // Toutes les photos de ces arrêts (y compris remplacées) : préfixe `entreprise/arrêt-`.
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
      const listed = await supabase.storage.from("delivery-pods").list(COMPANY, { limit: 1000 });
      const names = (listed.data ?? []).map((file) => `${COMPANY}/${file.name}`).filter((path) => stops.some((row) => path.startsWith(`${COMPANY}/${row.id}-`)));
      if (names.length > 0) await supabase.storage.from("delivery-pods").remove(names);
    }
    await prisma.operationJob.deleteMany({ where: { OR: rounds.map((round) => ({ jobKey: { startsWith: `driver-round:${round.id}:` } })) } });
    await prisma.stop.deleteMany({ where: { orderId: { in: orders.map((row) => row.id) } } });
    await prisma.round.deleteMany({ where: { id: { in: rounds.map((row) => row.id) } } });
    await prisma.auditLog.deleteMany({ where: { companyId: COMPANY, entityType: "Order", entityId: { in: orders.map((row) => row.id) } } });
    await prisma.orderLine.deleteMany({ where: { orderId: { in: orders.map((row) => row.id) } } });
    await prisma.order.deleteMany({ where: { id: { in: orders.map((row) => row.id) } } });
    await prisma.merchant.deleteMany({ where: { id: { in: merchants.map((row) => row.id) } } });
    if (slot) await prisma.slot.delete({ where: { id: slot.id } });
    // Journal écrit pendant la recette pour cette date : tournées (RoundDay) et passage forcé du verrouillage.
    await prisma.auditLog.deleteMany({ where: { companyId: COMPANY, entityType: { in: ["RoundDay", "DeliveryDay"] }, entityId: D, createdAt: { gte: STARTED_AT } } });
    if (!driverLocationExisted) await prisma.driverLocation.deleteMany({ where: { driverId: DRIVER_ID } });
  } finally {
    await prisma.$disconnect();
  }
}

test.beforeAll(async ({ browser }: { browser: Browser }) => {
  mkdirSync(SHOTS, { recursive: true });
  await cleanup();
  const prisma = new PrismaClient();
  try {
    driverLocationExisted = (await prisma.driverLocation.count({ where: { driverId: DRIVER_ID } })) > 0;
    const busy = await prisma.round.count({ where: { companyId: COMPANY, date: DB_DATE, driverId: DRIVER_ID } });
    if (busy > 0) throw new Error(`Le livreur de démo a déjà une tournée le ${D} : recette impossible sans toucher à une donnée existante.`);
    const slot = await prisma.slot.create({ data: { companyId: COMPANY, label: TAG, startTime: "04:00", endTime: "04:45", active: false, sortOrder: 99 } });
    slotId = slot.id;
    const products = await prisma.product.findMany({ where: { companyId: COMPANY, name: { in: ["Baguette tradition", "Croissant au beurre"] } }, select: { id: true } });
    let index = 0;
    for (const spec of MERCHANTS) {
      index += 1;
      const merchant = await prisma.merchant.create({
        data: { companyId: COMPANY, name: spec.name, address: `${index} rue de la Recette`, postalCode: "75011", city: "Paris", latitude: spec.latitude, longitude: spec.longitude, accessInstructions: spec.access },
      });
      await prisma.order.create({
        data: {
          companyId: COMPANY,
          reference: `${TAG}-${index}`,
          merchantId: merchant.id,
          deliveryDate: DB_DATE,
          slotId: slot.id,
          status: "VALIDATED",
          validatedAt: new Date(),
          notes: TAG,
          lines: { create: products.map((product, line) => ({ companyId: COMPANY, productId: product.id, quantityOrdered: 5 * index + line })) },
        },
      });
    }
  } finally {
    await prisma.$disconnect();
  }
  adminContext = await browser.newContext({ viewport: DESKTOP });
  driverContext = await browser.newContext({
    viewport: MOBILE,
    hasTouch: true,
    isMobile: true,
    geolocation: { latitude: 48.858, longitude: 2.378 },
    permissions: ["geolocation"],
  });
  // Les liens Plans / Waze ne quittent pas le poste de recette.
  await driverContext.route(/https:\/\/(maps\.apple\.com|waze\.com)\/.*/, (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<title>navigation</title>" }));
  admin = await adminContext.newPage();
  driver = await driverContext.newPage();
  watch(admin, "admin");
  watch(driver, "livreur");
});

test.afterAll(async () => {
  await adminContext?.close();
  await driverContext?.close();
  await cleanup();
  const prisma = new PrismaClient();
  try {
    const left = {
      slots: await prisma.slot.count({ where: { companyId: COMPANY, label: TAG } }),
      merchants: await prisma.merchant.count({ where: { companyId: COMPANY, name: { startsWith: TAG } } }),
      orders: await prisma.order.count({ where: { companyId: COMPANY, reference: { startsWith: TAG } } }),
      roundsOfDriver: await prisma.round.count({ where: { companyId: COMPANY, date: DB_DATE, driverId: DRIVER_ID } }),
      journal: await prisma.auditLog.count({ where: { companyId: COMPANY, entityType: "RoundDay", entityId: D, createdAt: { gte: STARTED_AT } } }),
    };
    report.leftovers = left;
    expect(left).toEqual({ slots: 0, merchants: 0, orders: 0, roundsOfDriver: 0, journal: 0 });
  } finally {
    await prisma.$disconnect();
  }
  report.consoleErrors = consoleErrors;
  console.log(`[TOUR-1] rapport ${JSON.stringify(report)}`);
});

test("Verrouillage du jour par le cron : la tournée du créneau d'essai est calculée", async ({ request }) => {
  const refused = await request.get(`/api/cron/lock-orders?date=${D}`, { headers: { Authorization: "Bearer faux" } });
  expect(refused.status()).toBe(401);
  const response = await request.get(`/api/cron/lock-orders?date=${D}&now=${encodeURIComponent(new Date().toISOString())}`, {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { data: { results: Array<{ companyId: string; ordersLocked: number; roundsCreated: number; stopsCreated: number }> } };
  const demo = body.data.results.find((row) => row.companyId === COMPANY)!;
  report.lock = demo;
  expect(demo.ordersLocked).toBeGreaterThanOrEqual(4);
  expect(demo.stopsCreated).toBeGreaterThanOrEqual(4);
  const prisma = new PrismaClient();
  try {
    const { rounds, stops } = await e2eStops(prisma);
    expect(rounds.map((round) => round.name)).toEqual([ROUND_A]);
    expect(stops.map((row) => row.sequence)).toEqual([1, 2, 3, 4]);
  } finally {
    await prisma.$disconnect();
  }
});

test("ADM-06, ADM-07 : l'admin crée une tournée, y déplace un arrêt, attribue et valide", async () => {
  await login(admin, accounts!.admin!, "/login", "/dashboard");
  await admin.goto(`/dashboard/rounds?date=${D}`);
  const slotSection = admin.getByTestId("admin-slot").filter({ has: admin.getByRole("heading", { name: `Créneau ${TAG}` }) });
  await expect(slotSection.getByTestId("admin-round")).toHaveCount(1);
  await slotSection.getByRole("button", { name: `Nouvelle tournée pour le créneau ${TAG}` }).click();
  await expect(slotSection.getByTestId("admin-round")).toHaveCount(2);
  const roundA = slotSection.locator(`[data-testid="admin-round"][data-round-name="${ROUND_A}"]`);
  const roundB = slotSection.locator(`[data-testid="admin-round"][data-round-name="${ROUND_B}"]`);
  await expect(roundB.getByText("Aucun arrêt")).toBeVisible();

  // Déplacer le premier arrêt de A vers B (menu « Déplacer vers », repli accessible du glisser-déposer).
  const firstStop = roundA.getByTestId("admin-stop").first();
  const moved = (await firstStop.getAttribute("data-merchant"))!;
  await roundA.getByRole("combobox", { name: `Déplacer ${moved} vers une autre tournée` }).click();
  await admin.getByRole("option", { name: ROUND_B }).click();
  await expect(roundB.getByTestId("admin-stop")).toHaveCount(1);
  await expect(roundA.getByTestId("admin-stop")).toHaveCount(3);
  await expect(roundA.getByTestId("admin-stop").locator("span[aria-hidden]").filter({ hasText: /^\d+$/ })).toHaveText(["1", "2", "3"]);
  report.movedStop = moved;

  // Glisser-déposer : le dernier arrêt de A passe en tête.
  const before = await roundA.getByTestId("admin-stop").evaluateAll((rows) => rows.map((row) => row.getAttribute("data-merchant")));
  await roundA.getByTestId("admin-stop").last().dragTo(roundA.getByTestId("admin-stop").first());
  await expect
    .poll(async () => roundA.getByTestId("admin-stop").evaluateAll((rows) => rows.map((row) => row.getAttribute("data-merchant"))))
    .toEqual([before[2], before[0], before[1]]);
  report.dragAndDrop = "ok";

  // Attribution (ADM-07) puis validation.
  await roundA.getByRole("combobox", { name: `Livreur de ${ROUND_A}` }).click();
  await admin.getByRole("option", { name: DRIVER_NAME }).click();
  await expect(roundA.getByRole("combobox", { name: `Livreur de ${ROUND_A}` })).toHaveText(DRIVER_NAME);
  await roundB.getByRole("combobox", { name: `Livreur de ${ROUND_B}` }).click();
  await admin.getByRole("option", { name: DRIVER_2_NAME }).click();
  await expect(roundB.getByRole("combobox", { name: `Livreur de ${ROUND_B}` })).toHaveText(DRIVER_2_NAME);
  await admin.getByTestId("admin-validate-rounds").click();
  await expect(roundA.getByTestId("admin-round-status")).toHaveText("Validée");
  await expect(roundB.getByTestId("admin-round-status")).toHaveText("Validée");
  await expect(admin.getByTestId("round-journal-entry").filter({ hasText: "Arrêt déplacé" })).toHaveCount(1);
  await slotSection.scrollIntoViewIfNeeded();
  await admin.screenshot({ path: `${SHOTS}/tour1-admin-tournees.png`, fullPage: true });
});

test("LIV-01, LIV-02, critère 6 : le livreur voit l'ordre, la liste de chargement, puis le nouvel ordre", async () => {
  await login(driver, accounts!["livreur-1"]!, "/login/driver", "/driver");
  await expect(driver.getByTestId("driver-round-summary")).toContainText(ROUND_A);
  const names = () => driver.getByTestId("driver-stops").getByTestId("driver-stop-name").allTextContents();
  const prisma = new PrismaClient();
  try {
    const expected = async () => (await e2eStops(prisma)).stops.filter((row) => row.order.merchant.name !== report.movedStop).map((row) => row.order.merchant.name);
    expect(await names()).toEqual(await expected());
    await expect(driver.getByTestId("driver-loading-item")).toHaveCount(3);
    const loading = await driver.getByTestId("driver-loading-item").locator("p.font-medium").allTextContents();
    expect(loading.map((text) => text.replace(/^\d+\. /, "").replace(/Arrêt \d+$/, "").trim())).toEqual([...(await expected())].reverse());
    await expect(driver.getByText(MERCHANTS.find((row) => row.name === report.movedStop)?.name ?? "absent")).toHaveCount(0);
    await shot(driver, "tour1-livreur-chargement", true);

    // Critère 6 : l'admin descend le premier arrêt ; au rafraîchissement, le livreur voit le nouvel ordre.
    const first = (await names())[0]!;
    await admin.getByRole("button", { name: `Descendre ${first}` }).click();
    await expect(admin.getByText("Ordre enregistré")).toBeVisible();
    await driver.reload();
    await expect.poll(async () => (await names())[1]).toBe(first);
    expect(await names()).toEqual(await expected());
    report.critere6 = { before: first, after: await names() };
  } finally {
    await prisma.$disconnect();
  }
});

test("LIV-03, LIV-04, LIV-05, critère 7 : démarrer, « Livré », arrêt suivant dans Plans en deux appuis, problème avec photo", async () => {
  await driver.getByTestId("driver-start").click();
  await expect(driver.getByTestId("driver-round-summary")).toContainText("En cours");
  const current = driver.locator('[data-testid="driver-stop"][aria-current="step"]');
  const firstName = (await current.getByTestId("driver-stop-name").textContent())!;
  await current.getByTestId("driver-delivered").click();

  // Critère 7 : appuis comptés depuis « Livré ».
  let taps = 0;
  const dialog = driver.getByTestId("driver-next-dialog");
  await expect(dialog.getByTestId("driver-next-stop")).toBeVisible();
  await shot(driver, "tour1-livreur-arret-suivant");
  await dialog.getByTestId("driver-go-next").click();
  taps += 1;
  await expect(dialog.getByTestId("driver-nav-menu")).toBeVisible();
  await expect(dialog.getByTestId("driver-go-alone")).toBeVisible();
  const waze = await dialog.getByTestId("driver-open-waze").getAttribute("href");
  await shot(driver, "tour1-livreur-menu-navigation");
  const [popup] = await Promise.all([driver.waitForEvent("popup"), dialog.getByTestId("driver-open-plans").click()]);
  taps += 1;
  const plansUrl = popup.url();
  await popup.close();
  expect(taps).toBe(2);
  expect(plansUrl).toMatch(/^https:\/\/maps\.apple\.com\/\?daddr=48\.\d{6},2\.\d{6}&dirflg=d$/);
  expect(waze).toMatch(/^https:\/\/waze\.com\/ul\?ll=48\.\d{6},2\.\d{6}&navigate=yes$/);
  report.critere7 = { taps, plansUrl, waze };

  const prisma = new PrismaClient();
  try {
    await expect.poll(async () => (await e2eStops(prisma)).stops.find((row) => row.order.merchant.name === firstName)?.status).toBe("DELIVERED");

    // Après synchronisation, l'arrêt reste affiché livré (pas de retour en arrière à la relecture).
    await expect(driver.locator(`[data-testid="driver-stop"][data-status="DELIVERED"]`).filter({ hasText: firstName })).toHaveCount(1);
    await expect(driver.locator('[data-testid="driver-stop"][aria-current="step"]').getByTestId("driver-stop-name")).not.toHaveText(firstName);

    // LIV-05 : problème avec commentaire et photo sur l'arrêt en cours.
    const second = driver.locator('[data-testid="driver-stop"][aria-current="step"]');
    const secondName = (await second.getByTestId("driver-stop-name").textContent())!;
    await second.getByTestId("driver-problem").click();
    const incident = driver.getByTestId("driver-incident-dialog");
    await incident.getByText("Client absent").click();
    await incident.getByLabel("Commentaire").fill(`${TAG} rideau fermé, appel sans réponse`);
    const png = await sharp({ create: { width: 320, height: 240, channels: 3, background: { r: 200, g: 120, b: 40 } } }).png().toBuffer();
    await incident.getByTestId("driver-incident-photo").setInputFiles({ name: "incident.png", mimeType: "image/png", buffer: png });
    await expect(incident.locator("img")).toBeVisible();
    await shot(driver, "tour1-livreur-probleme");
    await incident.getByTestId("driver-incident-send").click();
    await expect(incident).toBeHidden();
    await expect
      .poll(async () => {
        const row = (await e2eStops(prisma)).stops.find((stop) => stop.order.merchant.name === secondName);
        return row ? `${row.status}:${row.incidentCode}:${Boolean(row.incidentPhotoPath)}` : null;
      })
      .toBe("INCIDENT:ABSENT:true");
    report.incident = secondName;
  } finally {
    await prisma.$disconnect();
  }
});

test("LIV-06, critère 8 : « Livré » hors réseau, en attente, puis synchronisé et vu par l'admin", async () => {
  const prisma = new PrismaClient();
  try {
    const current = driver.locator('[data-testid="driver-stop"][aria-current="step"]');
    const name = (await current.getByTestId("driver-stop-name").textContent())!;
    await driverContext.setOffline(true);
    await current.getByTestId("driver-delivered").click();
    await expect(driver.getByTestId("driver-next-dialog")).toBeVisible();
    await driver.getByTestId("driver-next-dialog").getByRole("button", { name: "Fermer" }).first().click();
    await expect(driver.getByTestId("driver-pending-count")).toHaveText("1 action en attente de synchronisation");
    await expect(driver.locator(`[data-testid="driver-stop"]`).filter({ hasText: name }).getByTestId("driver-stop-pending")).toBeVisible();
    await shot(driver, "tour1-livreur-hors-reseau");
    // Rien n'est arrivé au serveur.
    const offlineStatus = (await e2eStops(prisma)).stops.find((row) => row.order.merchant.name === name)?.status;
    expect(offlineStatus).toBe("PENDING");

    await driverContext.setOffline(false);
    await expect.poll(async () => (await e2eStops(prisma)).stops.find((row) => row.order.merchant.name === name)?.status, { timeout: 30_000 }).toBe("DELIVERED");
    await expect(driver.getByTestId("driver-pending-count")).toHaveCount(0);
    await expect(driver.getByTestId("driver-round-summary")).toContainText("Terminée");
    await shot(driver, "tour1-livreur-termine");
    report.critere8 = { offlineStatus, synced: "DELIVERED", stop: name };

    // L'admin voit l'arrêt livré et l'incident dans le suivi en direct (ADM-08).
    await admin.goto("/dashboard");
    const liveRound = admin.locator(`[data-testid="live-round"][data-round-name="${ROUND_A}"]`);
    await expect(liveRound.getByTestId("live-round-progress")).toHaveText("2 / 3 livrés");
    const incident = admin.getByTestId("live-incident").filter({ hasText: report.incident as string });
    await expect(incident).toContainText("Client absent");
    await expect(incident).toContainText("rideau fermé");
    await expect(incident.getByTestId("live-incident-photo").locator("img")).toHaveJSProperty("complete", true);
    expect(await incident.getByTestId("live-incident-photo").locator("img").evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    await shot(admin, "tour1-admin-suivi", true);
    await admin.goto(`/dashboard/rounds?date=${D}`);
    await expect(admin.locator(`[data-testid="admin-stop"][data-merchant="${name}"]`)).toContainText("Livré à");
  } finally {
    await prisma.$disconnect();
  }
});
