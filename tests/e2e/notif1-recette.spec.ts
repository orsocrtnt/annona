/**
 * Recette navigateur NOTIF-1 sur annona-dev (comptes de démo de `npm run db:seed`) : NOT-01, NOT-02, NOT-03.
 * Lancer sur un serveur de dev déjà démarré (le paramètre `now` du cron est refusé en production) :
 *   E2E_BASE_URL=http://localhost:3250 E2E_SKIP_WEB_SERVER=1 npx playwright test tests/e2e/notif1-recette.spec.ts
 *
 * Données d'essai préfixées « E2E-NOTIF1 » : trois clients avec un compte chacun (Supabase Auth compris), un
 * créneau inactif, deux commandes du jour et une tournée attribuée à un livreur de démo sans tournée ce jour.
 * Parcours : le client Alpha commande dans le portail → « Commande validée » dans la cloche, e-mail en file
 * « ignoré » (pas de clé Resend) ; une modification rapprochée est regroupée (confirmation différée) ; le cron
 * des rappels, heure simulée, prévient Alpha qui n'a rien commandé pour le surlendemain, une seule fois ; le
 * livreur démarre la tournée (Beta prévenu), puis marque Beta « Livré » hors réseau ; au retour du réseau,
 * Gamma voit « Livreur en approche », une seule fois. Tout est supprimé à la fin (vérifié), y compris les
 * rappels créés pour les comptes de démo. Captures : outputs/recette-notif1-adm1/.
 */
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

type Account = { email: string; password: string };

function demoAccounts(): Record<string, Account> | null {
  try {
    return JSON.parse(readFileSync(resolve("outputs/comptes-demo.json"), "utf8")) as Record<string, Account>;
  } catch {
    return null;
  }
}

const accounts = demoAccounts();
const SHOTS = resolve("outputs/recette-notif1-adm1");
const COMPANY = "demo_company_boulangerie";
const TAG = "E2E-NOTIF1";
const STARTED_AT = new Date();
const MOBILE = { width: 390, height: 844 };
const paris = (offsetDays: number) => {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
  const value = new Date(`${today}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + offsetDays);
  return value.toISOString().slice(0, 10);
};
const TODAY = paris(0);
const ORDER_DATE = paris(4);
/** Rappel : heure simulée le lendemain à 15 h 05 (Paris), pour la livraison du surlendemain. */
const REMINDER_DATE = paris(2);
const PASSWORD = `E2e-${randomBytes(9).toString("base64url")}`;
const CLIENTS = [
  { key: "alpha", name: `${TAG} Café Alpha`, email: "e2e-notif1-alpha@example.com", latitude: 48.8566, longitude: 2.3794 },
  { key: "beta", name: `${TAG} Bistrot Beta`, email: "e2e-notif1-beta@example.com", latitude: 48.8619, longitude: 2.3644 },
  { key: "gamma", name: `${TAG} Épicerie Gamma`, email: "e2e-notif1-gamma@example.com", latitude: 48.8498, longitude: 2.3912 },
] as const;
type ClientKey = (typeof CLIENTS)[number]["key"];

test.describe.configure({ mode: "serial", timeout: 240_000 });
test.skip(!accounts, "outputs/comptes-demo.json absent : lancer npm run db:seed sur annona-dev");

const consoleErrors: string[] = [];
const report: Record<string, unknown> = {};
const ids: { merchants: Record<string, string>; users: Record<string, string>; slotId: string; roundId: string; driverKey: string; driverId: string; orderId: string } = {
  merchants: {}, users: {}, slotId: "", roundId: "", driverKey: "", driverId: "", orderId: "",
};
let clientContext: BrowserContext;
let driverContext: BrowserContext;

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

function watch(page: Page, label: string) {
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(`${label} : ${message.text().slice(0, 300)}`);
  });
  page.on("pageerror", (error) => consoleErrors.push(`${label} (exception) : ${error.message.slice(0, 300)}`));
}

async function login(page: Page, account: Account, path: "/login/client" | "/login/driver", home: string) {
  await page.goto(path);
  await page.locator('input[type="email"]').fill(account.email);
  await page.locator('input[name="password"]').fill(account.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL((url) => url.pathname.startsWith(home), { timeout: 60_000 });
}

async function logout(context: BrowserContext) {
  await context.clearCookies();
}

/** Ouvre la cloche du portail et renvoie le texte de ses notifications. */
async function openBell(page: Page) {
  await page.reload();
  await page.getByRole("button", { name: "Notifications" }).first().click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  return menu;
}

async function cleanup() {
  const prisma = new PrismaClient();
  try {
    const merchants = await prisma.merchant.findMany({ where: { companyId: COMPANY, name: { startsWith: TAG } }, select: { id: true } });
    const merchantIds = merchants.map((row) => row.id);
    const users = await prisma.user.findMany({ where: { email: { in: CLIENTS.map((client) => client.email) } }, select: { id: true, authId: true } });
    const orders = await prisma.order.findMany({ where: { companyId: COMPANY, merchantId: { in: merchantIds } }, select: { id: true } });
    const orderIds = orders.map((row) => row.id);
    const slot = await prisma.slot.findFirst({ where: { companyId: COMPANY, label: TAG } });
    const rounds = slot ? await prisma.round.findMany({ where: { companyId: COMPANY, slotId: slot.id }, select: { id: true } }) : [];
    const stops = await prisma.stop.findMany({ where: { orderId: { in: orderIds } }, select: { id: true } });
    // Tâches de notification de l'essai : celles des données E2E, et les rappels créés pendant l'essai pour la
    // date simulée (comptes de démo compris).
    await prisma.operationJob.deleteMany({
      where: {
        OR: [
          ...orderIds.map((id) => ({ jobKey: { startsWith: `not02:${id}:` } })),
          ...stops.map((row) => ({ jobKey: { startsWith: `not03:${row.id}:` } })),
          ...merchantIds.map((id) => ({ jobKey: { startsWith: `not01:${id}:` } })),
          { jobKey: { startsWith: "not01:" }, createdAt: { gte: STARTED_AT } },
          ...rounds.map((round) => ({ jobKey: { startsWith: `driver-round:${round.id}:` } })),
        ],
      },
    });
    await prisma.clientNotification.deleteMany({
      where: { OR: [{ userId: { in: users.map((row) => row.id) } }, { type: { in: ["REMINDER", "ORDER", "APPROACH"] }, createdAt: { gte: STARTED_AT } }] },
    });
    await prisma.stop.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.round.deleteMany({ where: { id: { in: rounds.map((row) => row.id) } } });
    await prisma.auditLog.deleteMany({ where: { companyId: COMPANY, entityType: "Order", entityId: { in: orderIds } } });
    await prisma.orderLine.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.user.deleteMany({ where: { id: { in: users.map((row) => row.id) } } });
    await prisma.merchant.deleteMany({ where: { id: { in: merchantIds } } });
    if (slot) await prisma.slot.delete({ where: { id: slot.id } });
    if (ids.driverId) await prisma.driverLocation.deleteMany({ where: { driverId: ids.driverId, updatedAt: { gte: STARTED_AT } } });
    const supabase = admin();
    for (const client of CLIENTS) {
      const listed = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const found = listed.data?.users.find((candidate) => candidate.email === client.email);
      if (found) await supabase.auth.admin.deleteUser(found.id);
    }
  } finally {
    await prisma.$disconnect();
  }
}

test.beforeAll(async ({ browser }: { browser: Browser }) => {
  mkdirSync(SHOTS, { recursive: true });
  await cleanup();
  const prisma = new PrismaClient();
  try {
    const role = await prisma.role.findUniqueOrThrow({ where: { slug: "merchant" } });
    const supabase = admin();
    for (const [index, client] of CLIENTS.entries()) {
      const merchant = await prisma.merchant.create({
        data: { companyId: COMPANY, name: client.name, address: `${index + 1} rue de la Recette`, postalCode: "75011", city: "Paris", latitude: client.latitude, longitude: client.longitude },
      });
      const created = await supabase.auth.admin.createUser({ email: client.email, password: PASSWORD, email_confirm: true });
      if (created.error || !created.data.user) throw new Error(`Compte Supabase ${client.key} : ${created.error?.message}`);
      const user = await prisma.user.create({
        data: { authId: created.data.user.id, email: client.email, firstName: "E2E", lastName: client.key, roleId: role.id, companyId: COMPANY, merchantId: merchant.id, status: "ACTIVE" },
      });
      ids.merchants[client.key] = merchant.id;
      ids.users[client.key] = user.id;
    }
    // Livreur de démo sans tournée aujourd'hui : la tournée d'essai est la seule qu'il voit.
    for (const key of ["livreur-5", "livreur-4", "livreur-3", "livreur-2", "livreur-1"]) {
      const driver = await prisma.user.findUnique({ where: { email: accounts![key]!.email }, select: { id: true } });
      if (driver && (await prisma.round.count({ where: { companyId: COMPANY, date: new Date(`${TODAY}T00:00:00.000Z`), driverId: driver.id } })) === 0) {
        ids.driverKey = key;
        ids.driverId = driver.id;
        break;
      }
    }
    if (!ids.driverId) throw new Error(`Tous les livreurs de démo ont une tournée le ${TODAY} : recette impossible sans toucher aux données existantes.`);
    const slot = await prisma.slot.create({ data: { companyId: COMPANY, label: TAG, startTime: "04:00", endTime: "04:45", active: false, sortOrder: 99 } });
    ids.slotId = slot.id;
    const product = await prisma.product.findFirstOrThrow({ where: { companyId: COMPANY, name: "Croissant au beurre" }, select: { id: true } });
    const round = await prisma.round.create({ data: { companyId: COMPANY, date: new Date(`${TODAY}T00:00:00.000Z`), slotId: slot.id, driverId: ids.driverId, name: `Tournée ${TAG}`, status: "ASSIGNED" } });
    ids.roundId = round.id;
    for (const [sequence, key] of (["beta", "gamma"] as const).entries()) {
      const order = await prisma.order.create({
        data: {
          companyId: COMPANY, reference: `${TAG}-${key}`, merchantId: ids.merchants[key]!, deliveryDate: new Date(`${TODAY}T00:00:00.000Z`), slotId: slot.id,
          status: "LOCKED", lockedAt: new Date(), notes: TAG,
          lines: { create: [{ companyId: COMPANY, productId: product.id, quantityOrdered: 6 + sequence, unitPriceFrozenCents: 120 }] },
        },
      });
      await prisma.stop.create({ data: { companyId: COMPANY, roundId: round.id, orderId: order.id, sequence: sequence + 1 } });
    }
  } finally {
    await prisma.$disconnect();
  }
  clientContext = await browser.newContext({ viewport: MOBILE, hasTouch: true, isMobile: true });
  driverContext = await browser.newContext({ viewport: MOBILE, hasTouch: true, isMobile: true, geolocation: { latitude: 48.858, longitude: 2.378 }, permissions: ["geolocation"] });
});

test.afterAll(async () => {
  await clientContext?.close();
  await driverContext?.close();
  await cleanup();
  const prisma = new PrismaClient();
  try {
    const supabase = admin();
    const listed = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const left = {
      merchants: await prisma.merchant.count({ where: { companyId: COMPANY, name: { startsWith: TAG } } }),
      users: await prisma.user.count({ where: { email: { in: CLIENTS.map((client) => client.email) } } }),
      authUsers: (listed.data?.users ?? []).filter((user) => CLIENTS.some((client) => client.email === user.email)).length,
      orders: await prisma.order.count({ where: { companyId: COMPANY, reference: { startsWith: TAG } } }),
      slots: await prisma.slot.count({ where: { companyId: COMPANY, label: TAG } }),
      rounds: await prisma.round.count({ where: { companyId: COMPANY, name: `Tournée ${TAG}` } }),
      jobs: await prisma.operationJob.count({ where: { OR: [{ jobKey: { startsWith: "not0" } }], createdAt: { gte: STARTED_AT } } }),
      notifications: await prisma.clientNotification.count({ where: { type: { in: ["REMINDER", "ORDER", "APPROACH"] }, createdAt: { gte: STARTED_AT } } }),
    };
    report.leftovers = left;
    expect(left).toEqual({ merchants: 0, users: 0, authUsers: 0, orders: 0, slots: 0, rounds: 0, jobs: 0, notifications: 0 });
  } finally {
    await prisma.$disconnect();
  }
  report.consoleErrors = consoleErrors;
  console.log(`[NOTIF-1] rapport ${JSON.stringify(report)}`);
});

const account = (key: ClientKey): Account => ({ email: CLIENTS.find((client) => client.key === key)!.email, password: PASSWORD });

test("NOT-02 : le client commande → « Commande validée » dans la cloche, e-mail en file non envoyé ; modification rapprochée regroupée", async () => {
  const page = await clientContext.newPage();
  watch(page, "client");
  await login(page, account("alpha"), "/login/client", "/portal");
  await expect(page.getByRole("heading", { name: "Commander" })).toBeVisible();
  await page.locator("#order-other-date").fill(ORDER_DATE);
  await page.getByRole("radio", { name: "7h – 8h" }).click();
  await page.getByLabel("Rechercher un produit").fill("Croissant au beurre");
  for (let i = 0; i < 3; i += 1) await page.getByRole("button", { name: "Ajouter un Croissant au beurre" }).click();
  await page.getByRole("button", { name: "Voir le panier" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Valider la commande" }).click();
  await page.waitForURL(/\/portal\/orders\/[^/?]+/);
  ids.orderId = new URL(page.url()).pathname.split("/").pop()!;

  const prisma = new PrismaClient();
  try {
    const firstKey = `not02:${ids.orderId}:0:${ids.users.alpha}`;
    await expect.poll(async () => (await prisma.operationJob.findUnique({ where: { jobKey: firstKey } }))?.status, { timeout: 30_000 }).toBe("SUCCEEDED");
    const job = await prisma.operationJob.findUniqueOrThrow({ where: { jobKey: firstKey } });
    // Pas de clé Resend : la notification est dans l'application, l'e-mail est tracé « ignoré ».
    expect(job.lastError).toBe("SKIPPED:EMAIL_DISABLED");
    report.not02 = { job: job.status, email: job.lastError };

    const menu = await openBell(page);
    const item = menu.getByRole("menuitem").filter({ hasText: "Commande validée" });
    await expect(item).toHaveCount(1);
    await expect(item).toContainText("3 articles");
    await page.screenshot({ path: `${SHOTS}/notif1-01-confirmation-cloche-mobile.png` });
    await page.keyboard.press("Escape");

    // Modification aussitôt après : regroupée dans une confirmation différée (au plus une toutes les 5 min).
    await page.goto(`/portal/orders/${ids.orderId}`);
    await page.getByRole("button", { name: "Modifier" }).click();
    await page.getByLabel("Rechercher un produit").fill("Croissant au beurre");
    await page.getByRole("button", { name: "Ajouter un Croissant au beurre" }).click();
    await page.getByRole("button", { name: "Voir le panier" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Enregistrer les modifications" }).click();
    await page.waitForURL(/saved=1/);
    await expect.poll(async () => prisma.operationJob.count({ where: { jobKey: { startsWith: `not02:${ids.orderId}:` } } })).toBe(2);
    const deferred = await prisma.operationJob.findUniqueOrThrow({ where: { jobKey: `not02:${ids.orderId}:1:${ids.users.alpha}` } });
    expect(deferred.status).toBe("PENDING");
    expect(deferred.nextAttemptAt.getTime()).toBe(job.nextAttemptAt.getTime() + 5 * 60_000);
    report.not02Grouped = { deferredUntil: deferred.nextAttemptAt.toISOString() };
  } finally {
    await prisma.$disconnect();
  }
  await page.close();
});

test("NOT-01 : le cron des rappels (heure simulée) prévient le client sans commande, une seule fois", async ({ request }) => {
  const refused = await request.get("/api/cron/order-reminders", { headers: { Authorization: "Bearer faux" } });
  expect(refused.status()).toBe(401);
  // Le lendemain à 15 h 05 (Paris, heure d'hiver : UTC+1) : fenêtre du rappel de la livraison du surlendemain.
  const now = new Date(`${paris(1)}T14:05:00.000Z`).toISOString();
  const call = () => request.get(`/api/cron/order-reminders?now=${encodeURIComponent(now)}`, { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } });
  const response = await call();
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { data: { windows: Array<{ companyId: string; date: string }>; queued: number } };
  expect(body.data.windows).toContainEqual({ companyId: COMPANY, date: REMINDER_DATE });
  const prisma = new PrismaClient();
  try {
    const key = `not01:${ids.merchants.alpha}:${REMINDER_DATE}:${ids.users.alpha}`;
    await expect.poll(async () => (await prisma.operationJob.findUnique({ where: { jobKey: key } }))?.status, { timeout: 60_000 }).toBe("SUCCEEDED");
    expect((await call()).status()).toBe(200);
    expect(await prisma.operationJob.count({ where: { jobKey: { startsWith: `not01:${ids.merchants.alpha}:` } } })).toBe(1);
    report.not01 = { date: REMINDER_DATE, queued: body.data.queued };
  } finally {
    await prisma.$disconnect();
  }
  const page = await clientContext.newPage();
  watch(page, "client");
  await page.goto("/portal");
  const menu = await openBell(page);
  const item = menu.getByRole("menuitem").filter({ hasText: "Pensez à commander pour demain" });
  await expect(item).toHaveCount(1);
  await expect(item).toContainText("Vous pouvez commander jusqu'au");
  await page.screenshot({ path: `${SHOTS}/notif1-02-rappel-cloche-mobile.png` });
  await page.close();
  await logout(clientContext);
});

test("NOT-03 : démarrage puis « Livré » hors réseau → « Livreur en approche » chez le client suivant, une seule fois", async () => {
  const driver = await driverContext.newPage();
  watch(driver, "livreur");
  await login(driver, accounts![ids.driverKey]!, "/login/driver", "/driver");
  await expect(driver.getByTestId("driver-round-summary")).toContainText(`Tournée ${TAG}`);
  await driver.getByTestId("driver-start").click();
  const prisma = new PrismaClient();
  try {
    const stops = await prisma.stop.findMany({ where: { roundId: ids.roundId }, orderBy: { sequence: "asc" }, select: { id: true } });
    const [betaStop, gammaStop] = stops;
    // Au démarrage, le premier arrêt (Beta) est prévenu.
    await expect.poll(async () => prisma.operationJob.count({ where: { jobKey: `not03:${betaStop!.id}:${ids.users.beta}` } })).toBe(1);

    // « Livré » chez Beta hors réseau, puis retour du réseau : la file rejoue l'action.
    await driverContext.setOffline(true);
    await driver.locator('[data-testid="driver-stop"][aria-current="step"]').getByTestId("driver-delivered").click();
    await expect(driver.getByTestId("driver-next-dialog")).toBeVisible();
    await driver.getByTestId("driver-next-dialog").getByRole("button", { name: "Fermer" }).first().click();
    await expect(driver.getByTestId("driver-pending-count")).toHaveText("1 action en attente de synchronisation");
    expect(await prisma.operationJob.count({ where: { jobKey: { startsWith: `not03:${gammaStop!.id}:` } } })).toBe(0);
    await driverContext.setOffline(false);
    const gammaKey = `not03:${gammaStop!.id}:${ids.users.gamma}`;
    await expect.poll(async () => (await prisma.operationJob.findUnique({ where: { jobKey: gammaKey } }))?.status, { timeout: 60_000 }).toBe("SUCCEEDED");
    await expect(driver.getByTestId("driver-pending-count")).toHaveCount(0);
    await driver.screenshot({ path: `${SHOTS}/notif1-03-livreur-livre-mobile.png` });
    // Rechargement (relecture, rejeu éventuel) : toujours une seule tâche par arrêt.
    await driver.reload();
    await expect(driver.getByTestId("driver-round-summary")).toContainText(`Tournée ${TAG}`);
    expect(await prisma.operationJob.count({ where: { jobKey: { startsWith: "not03:" }, createdAt: { gte: STARTED_AT } } })).toBe(2);
    report.not03 = { start: "Beta prévenu", afterDelivered: "Gamma prévenu", jobs: 2 };
  } finally {
    await prisma.$disconnect();
  }
  await driver.close();

  const page = await clientContext.newPage();
  watch(page, "client gamma");
  await login(page, account("gamma"), "/login/client", "/portal");
  const menu = await openBell(page);
  const item = menu.getByRole("menuitem").filter({ hasText: "Livreur en approche" });
  await expect(item).toHaveCount(1);
  await expect(item).toContainText(`${TAG}-gamma`);
  await page.screenshot({ path: `${SHOTS}/notif1-04-livreur-en-approche-mobile.png` });
  await page.close();
  expect(consoleErrors).toEqual([]);
});
