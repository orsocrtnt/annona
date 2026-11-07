/**
 * RECETTE-V1 — les dix critères de recette du cahier des charges (section 10), rejoués comme une journée.
 *
 * Lancer sur un build de production local déjà démarré (rien n'utilise le paramètre `now` des crons) :
 *   npm run build && npx dotenv -e .env.local -- npx next start -H 127.0.0.1 -p 3270
 *   E2E_BASE_URL=http://localhost:3270 E2E_SKIP_WEB_SERVER=1 npx playwright test tests/e2e/recette-v1.spec.ts
 *
 * Données : une entreprise d'essai « E2E-V1 Boulangerie » créée pour la journée (catalogue de trois produits,
 * deux créneaux, quatre clients, un admin, un boulanger, un livreur, comptes Supabase compris), supprimée à
 * la fin avec tout ce qu'elle contient (vérifié). L'entreprise de démo sert d'entreprise B pour le critère 10 :
 * rien n'y est écrit.
 *
 * Heure : pas d'heure simulée côté serveur. La journée tient en quelques minutes grâce à deux réglages de
 * l'entreprise d'essai, lus par le vrai code :
 *  - l'heure limite est réglée par l'admin, dans l'écran Paramètres, sur la minute qui suit : la commande
 *    est modifiée juste avant (l'équivalent de 16h59), puis refusée par le serveur juste après (17h00) ;
 *  - « la nuit passe » en changeant le fuseau de l'entreprise : la commande est passée dans un fuseau où la
 *    date de livraison D est demain, puis la tournée est livrée dans un fuseau où D est aujourd'hui (le
 *    démarrage d'une tournée n'est permis que le jour même). Le couple de fuseaux est choisi à l'exécution.
 *
 * Parcours : la veille, le client A recopie sa commande de la semaine dernière (chronométré, 390 px), A voit
 * son prix, B le prix de base ; C commande puis annule et reçoit le rappel ; l'heure limite passe (critère 2) ;
 * le boulanger ouvre la production (verrouillage, récurrentes générées sauf celle remplacée par la commande
 * manuelle de A), vérifie les totaux, signale un manquant, coche puis décoche « préparée » ; l'admin attribue
 * et valide la tournée générée. Le lendemain : l'admin déplace un arrêt, le livreur voit le nouvel ordre,
 * démarre, « Livré » puis Plans en deux appuis, « Livré » hors réseau (rechargement compris) vu par l'admin au
 * retour du réseau ; l'admin facture A, le manquant réduit la facture ; isolation A / B ; passe sombre et
 * tablette. Captures et rapport JSON : outputs/recette-v1/.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
const OUT = resolve("outputs/recette-v1");
const TAG = "E2E-V1";
const COMPANY_NAME = `${TAG} Boulangerie`;
const DEMO_COMPANY = "demo_company_boulangerie";
const STARTED_AT = new Date();
const PASSWORD = `E2e-${randomBytes(9).toString("base64url")}`;
const MOBILE = { width: 390, height: 844 };
const TABLET = { width: 1024, height: 768 };
const DESKTOP = { width: 1440, height: 900 };

const BAGUETTE = "Baguette tradition";
const CROISSANT = "Croissant au beurre";
const PAIN = "Pain de campagne";
const PRODUCTS = [
  { name: BAGUETTE, unit: "pièce", basePriceCents: 120 },
  { name: CROISSANT, unit: "pièce", basePriceCents: 110 },
  { name: PAIN, unit: "pièce", basePriceCents: 380 },
] as const;
/** Prix spécifique du client A sur la baguette (critère 3). */
const SPECIFIC_CENTS = 105;

const MERCHANTS = {
  a: { name: `${TAG} Café Alpha`, latitude: 48.8566, longitude: 2.3794 },
  b: { name: `${TAG} Bistrot Beta`, latitude: 48.8619, longitude: 2.3644 },
  c: { name: `${TAG} Épicerie Gamma`, latitude: 48.8498, longitude: 2.3912 },
  d: { name: `${TAG} Hôtel Delta`, latitude: 48.8601, longitude: 2.3502 },
} as const;
type MerchantKey = keyof typeof MERCHANTS;
const USERS = {
  admin: { email: "e2e-v1-admin@example.com", role: "admin", firstName: "Alice", lastName: "Admin V1", merchant: null },
  baker: { email: "e2e-v1-boulanger@example.com", role: "baker", firstName: "Basile", lastName: "Boulanger V1", merchant: null },
  driver: { email: "e2e-v1-livreur@example.com", role: "driver", firstName: "Victor", lastName: "Livreur V1", merchant: null },
  a: { email: "e2e-v1-client-a@example.com", role: "merchant", firstName: "Anna", lastName: "Alpha", merchant: "a" },
  b: { email: "e2e-v1-client-b@example.com", role: "merchant", firstName: "Bruno", lastName: "Beta", merchant: "b" },
  c: { email: "e2e-v1-client-c@example.com", role: "merchant", firstName: "Chloé", lastName: "Gamma", merchant: "c" },
} as const;
type UserKey = keyof typeof USERS;
const DRIVER_NAME = `${USERS.driver.firstName} ${USERS.driver.lastName}`;
const account = (key: UserKey): Account => ({ email: USERS[key].email, password: PASSWORD });

// ---------------------------------------------------------------------------
// Heure : fuseaux de la veille (commande) et du jour (livraison)
// ---------------------------------------------------------------------------

/** Fuseaux proposés par l'application, puis deux fuseaux extrêmes en dernier recours (couverture 24 h). */
const ZONES = ["Europe/Paris", "Indian/Reunion", "Indian/Mayotte", "America/Martinique", "America/Cayenne", "Pacific/Tahiti", "Pacific/Noumea", "Etc/GMT+12", "Etc/GMT-14"];

function local(timeZone: string, at: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(at)
      .map((part) => [part.type, part.value])
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute), hhmm: `${parts.hour}:${parts.minute}` };
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/**
 * Couple (veille, jour) : dans le fuseau de la veille il est au plus 22h et D = demain ; dans le fuseau du
 * jour, D est aujourd'hui pendant les deux heures qui viennent.
 */
function pickZones(now: Date) {
  for (const order of ZONES) {
    const there = local(order, now);
    if (there.minutes > 22 * 60) continue;
    const day = addDays(there.date, 1);
    for (const deliver of ZONES) {
      if (deliver === order) continue;
      if ([5, 30, 60, 120].every((minutes) => local(deliver, new Date(now.getTime() + minutes * 60_000)).date === day)) {
        return { orderZone: order, deliverZone: deliver, D: day };
      }
    }
  }
  throw new Error("Aucun couple de fuseaux ne convient (impossible en théorie).");
}

const ZONE = pickZones(STARTED_AT);
const D = ZONE.D;
const DB_D = new Date(`${D}T00:00:00.000Z`);
const LAST_WEEK = addDays(D, -7);
const ISO_WEEKDAY = ((new Date(`${D}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;

// ---------------------------------------------------------------------------
// Outils
// ---------------------------------------------------------------------------

test.describe.configure({ mode: "serial", timeout: 300_000 });
test.skip(!accounts, "outputs/comptes-demo.json absent : lancer npm run db:seed sur annona-dev");

const consoleErrors: string[] = [];
const report: Record<string, unknown> = { zones: ZONE, startedAt: STARTED_AT.toISOString() };
const ids = {
  company: "",
  merchants: {} as Record<MerchantKey, string>,
  users: {} as Record<UserKey, string>,
  products: {} as Record<string, string>,
  slot: "",
  orderA: "",
  orderC: "",
  invoice: "",
  invoiceRef: "",
};

function supabaseAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

function watch(page: Page, label: string) {
  page.on("console", (message) => {
    if (message.type() === "error" && !/status of 40[134]/.test(message.text())) consoleErrors.push(`${label} : ${message.text().slice(0, 300)}`);
  });
  page.on("pageerror", (error) => consoleErrors.push(`${label} (exception) : ${error.message.slice(0, 300)}`));
}

async function shot(page: Page, name: string, fullPage = false) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage });
}

async function login(page: Page, credentials: Account, path: "/login" | "/login/client" | "/login/driver", home: string) {
  await page.goto(path);
  await page.locator('input[type="email"]').fill(credentials.email);
  await page.locator('input[name="password"]').fill(credentials.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL((url) => url.pathname.startsWith(home), { timeout: 60_000 });
}

async function openBell(page: Page) {
  await page.reload();
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.getByRole("button", { name: "Notifications" }).first().click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  return menu;
}

async function withPrisma<T>(work: (prisma: PrismaClient) => Promise<T>) {
  const prisma = new PrismaClient();
  try {
    return await work(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

async function setCompanyZone(timeZone: string) {
  await withPrisma((prisma) => prisma.company.update({ where: { id: ids.company }, data: { timezone: timeZone } }));
}

async function cleanup() {
  await withPrisma(async (prisma) => {
    const companies = await prisma.company.findMany({ where: { name: { startsWith: TAG } }, select: { id: true } });
    for (const { id: companyId } of companies) {
      await prisma.invoice.deleteMany({ where: { companyId } });
      await prisma.stop.deleteMany({ where: { companyId } });
      await prisma.round.deleteMany({ where: { companyId } });
      await prisma.order.deleteMany({ where: { companyId } });
      await prisma.recurringOrder.deleteMany({ where: { companyId } });
      await prisma.merchantPrice.deleteMany({ where: { companyId } });
      await prisma.product.deleteMany({ where: { companyId } });
      await prisma.category.deleteMany({ where: { companyId } });
      await prisma.slot.deleteMany({ where: { companyId } });
      await prisma.user.deleteMany({ where: { companyId } });
      await prisma.merchant.deleteMany({ where: { companyId } });
      await prisma.company.delete({ where: { id: companyId } });
    }
    const emails: string[] = Object.values(USERS).map((user) => user.email);
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    // Rappels de la démo créés pendant la recette (si l'appel du cron des rappels tombe dans sa fenêtre).
    await prisma.operationJob.deleteMany({ where: { companyId: DEMO_COMPANY, jobKey: { startsWith: "not01:" }, createdAt: { gte: STARTED_AT } } });
    await prisma.clientNotification.deleteMany({ where: { companyId: DEMO_COMPANY, type: "REMINDER", createdAt: { gte: STARTED_AT } } });
    const listed = await supabaseAdmin().auth.admin.listUsers({ page: 1, perPage: 1000 });
    for (const found of (listed.data?.users ?? []).filter((user) => emails.includes(user.email ?? ""))) {
      await supabaseAdmin().auth.admin.deleteUser(found.id);
    }
  });
}

// ---------------------------------------------------------------------------
// Mise en place : l'entreprise d'essai, son catalogue, ses clients et la commande de la semaine dernière
// ---------------------------------------------------------------------------

const contexts: Record<string, BrowserContext> = {};
const pages: Record<string, Page> = {};

test.beforeAll(async ({ browser }: { browser: Browser }) => {
  mkdirSync(OUT, { recursive: true });
  await cleanup();
  await withPrisma(async (prisma) => {
    const demo = await prisma.company.findUniqueOrThrow({ where: { id: DEMO_COMPANY } });
    const company = await prisma.company.create({
      data: {
        name: COMPANY_NAME,
        slug: `e2e-v1-${Date.now().toString(36)}`,
        status: "ACTIVE",
        // Heure limite tardive : la veille, la commande reste ouverte jusqu'à ce que l'admin la règle (critère 2).
        cutoffTime: "23:59",
        timezone: ZONE.orderZone,
        reminderLeadMinutes: 120,
        address: demo.address,
        city: demo.city,
        legalName: `${COMPANY_NAME} SAS`,
        billingAddress: demo.billingAddress,
        billingPostalCode: demo.billingPostalCode,
        billingCity: demo.billingCity,
        depotLatitude: demo.depotLatitude,
        depotLongitude: demo.depotLongitude,
        settings: { billing: { invoice: { footerNote: "Recette E2E-V1 : aucune facture réelle." } } },
      },
    });
    ids.company = company.id;
    const category = await prisma.category.create({ data: { companyId: company.id, name: "Pains et viennoiseries", sortOrder: 0 } });
    for (const [index, product] of PRODUCTS.entries()) {
      const row = await prisma.product.create({ data: { companyId: company.id, categoryId: category.id, sortOrder: index, vatRateBasisPoints: 550, ...product } });
      ids.products[product.name] = row.id;
    }
    const slot = await prisma.slot.create({ data: { companyId: company.id, label: "7h – 8h", startTime: "07:00", endTime: "08:00", sortOrder: 0 } });
    await prisma.slot.create({ data: { companyId: company.id, label: "9h – 10h", startTime: "09:00", endTime: "10:00", sortOrder: 1 } });
    ids.slot = slot.id;
    for (const [index, [key, spec]] of Object.entries(MERCHANTS).entries()) {
      const merchant = await prisma.merchant.create({
        data: {
          companyId: company.id, name: spec.name, address: `${index + 1} rue de la Recette`, postalCode: "75011", city: "Paris",
          latitude: spec.latitude, longitude: spec.longitude, billingPeriod: "DAILY", paymentMethod: "VIREMENT", billingEmail: `e2e-v1-factures-${key}@example.com`,
        },
      });
      ids.merchants[key as MerchantKey] = merchant.id;
    }
    await prisma.merchantPrice.create({ data: { companyId: company.id, merchantId: ids.merchants.a, productId: ids.products[BAGUETTE]!, priceCents: SPECIFIC_CENTS } });

    // Comptes : profil Annona et compte Supabase confirmé.
    const roles = new Map((await prisma.role.findMany()).map((role) => [role.slug, role.id]));
    for (const [key, spec] of Object.entries(USERS)) {
      const created = await supabaseAdmin().auth.admin.createUser({ email: spec.email, password: PASSWORD, email_confirm: true });
      if (created.error || !created.data.user) throw new Error(`Compte Supabase ${key} : ${created.error?.message}`);
      const user = await prisma.user.create({
        data: {
          authId: created.data.user.id, email: spec.email, firstName: spec.firstName, lastName: spec.lastName, status: "ACTIVE",
          roleId: roles.get(spec.role)!, companyId: company.id, merchantId: spec.merchant ? ids.merchants[spec.merchant] : null,
        },
      });
      ids.users[key as UserKey] = user.id;
    }

    // La semaine dernière : commande livrée de A (prix figés), celle qu'il va recopier.
    await prisma.order.create({
      data: {
        companyId: company.id, reference: `${TAG}-S-1`, merchantId: ids.merchants.a, deliveryDate: new Date(`${LAST_WEEK}T00:00:00.000Z`), slotId: slot.id,
        status: "DELIVERED", validatedAt: new Date(), lockedAt: new Date(), deliveredAt: new Date(), createdById: ids.users.a,
        lines: {
          create: [
            { companyId: company.id, productId: ids.products[BAGUETTE]!, quantityOrdered: 20, quantityDelivered: 20, unitPriceFrozenCents: SPECIFIC_CENTS },
            { companyId: company.id, productId: ids.products[CROISSANT]!, quantityOrdered: 10, quantityDelivered: 10, unitPriceFrozenCents: 110 },
          ],
        },
      },
    });
    // Récurrentes actives le jour de D : A (sera remplacée par sa commande manuelle), B et Delta (générées).
    const recurring = [
      { key: "a" as const, lines: [[PAIN, 2]] },
      { key: "b" as const, lines: [[BAGUETTE, 15], [CROISSANT, 8]] },
      { key: "d" as const, lines: [[BAGUETTE, 30], [PAIN, 4]] },
    ];
    for (const spec of recurring) {
      await prisma.recurringOrder.create({
        data: {
          companyId: company.id, merchantId: ids.merchants[spec.key], slotId: slot.id, label: `${TAG} habituelle`, weekdays: [1, 2, 3, 4, 5, 6, 7], active: true,
          lines: { create: spec.lines.map(([name, quantity]) => ({ companyId: company.id, productId: ids.products[name as string]!, quantity: quantity as number })) },
        },
      });
    }
  });
  report.D = D;
  report.weekday = ISO_WEEKDAY;

  const make = async (key: string, options: Parameters<Browser["newContext"]>[0]) => {
    contexts[key] = await browser.newContext(options);
    pages[key] = await contexts[key]!.newPage();
    watch(pages[key]!, key);
  };
  await make("a", { viewport: MOBILE, hasTouch: true, isMobile: true });
  await make("admin", { viewport: DESKTOP });
  await make("baker", { viewport: TABLET, hasTouch: true });
  await make("driver", { viewport: MOBILE, hasTouch: true, isMobile: true, geolocation: { latitude: 48.858, longitude: 2.378 }, permissions: ["geolocation"] });
  // Les liens Plans / Waze ne quittent pas le poste de recette.
  await contexts.driver!.route(/https:\/\/(maps\.apple\.com|waze\.com)\/.*/, (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<title>navigation</title>" }));
  await pages.baker!.addInitScript(() => {
    window.print = () => {};
  });
});

test.afterAll(async () => {
  for (const context of Object.values(contexts)) await context.close().catch(() => undefined);
  await cleanup();
  const left = await withPrisma(async (prisma) => {
    const listed = await supabaseAdmin().auth.admin.listUsers({ page: 1, perPage: 1000 });
    const emails: string[] = Object.values(USERS).map((user) => user.email);
    return {
      companies: await prisma.company.count({ where: { name: { startsWith: TAG } } }),
      merchants: await prisma.merchant.count({ where: { name: { startsWith: TAG } } }),
      orders: await prisma.order.count({ where: { companyId: ids.company } }),
      users: await prisma.user.count({ where: { email: { in: emails } } }),
      authUsers: (listed.data?.users ?? []).filter((user) => emails.includes(user.email ?? "")).length,
      jobs: await prisma.operationJob.count({ where: { OR: [{ companyId: ids.company }, { companyId: DEMO_COMPANY, jobKey: { startsWith: "not01:" }, createdAt: { gte: STARTED_AT } }] } }),
      notifications: await prisma.clientNotification.count({ where: { OR: [{ companyId: ids.company }, { companyId: DEMO_COMPANY, type: "REMINDER", createdAt: { gte: STARTED_AT } }] } }),
      demoWrites: await prisma.order.count({ where: { companyId: DEMO_COMPANY, updatedAt: { gte: STARTED_AT } } }),
    };
  });
  report.leftovers = left;
  report.consoleErrors = consoleErrors;
  writeFileSync(`${OUT}/rapport.json`, JSON.stringify(report, null, 2));
  console.log(`[RECETTE-V1] rapport ${JSON.stringify(report)}`);
  expect(left).toEqual({ companies: 0, merchants: 0, orders: 0, users: 0, authUsers: 0, jobs: 0, notifications: 0, demoWrites: 0 });
});

// ---------------------------------------------------------------------------
// La veille
// ---------------------------------------------------------------------------

test("Veille — critère 1 : A recopie sa commande de la semaine dernière en moins d'une minute (390 px) ; NOT-02", async () => {
  const page = pages.a!;
  await login(page, account("a"), "/login/client", "/portal");
  await expect(page.getByRole("heading", { name: "Commander" })).toBeVisible();
  await shot(page, "v1-01-portail-commander-mobile");

  const started = Date.now();
  await page.getByRole("link", { name: "Recommander" }).click();
  await page.waitForURL(/\/portal\/orders\?tab=history/);
  const card = page.locator("[data-testid^=order-card-]").first();
  await card.getByRole("button", { name: "Recommander" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByTestId("reorder-summary")).toContainText("produits");
  await dialog.locator("#reorder-other-date").fill(D);
  await shot(page, "v1-02-recommander-mobile");
  await dialog.getByRole("button", { name: "Valider la commande" }).click();
  await page.waitForURL(/\/portal\/orders\/[^/?]+\?saved=1/);
  await expect(page.getByText("Validée", { exact: true })).toBeVisible();
  const elapsedMs = Date.now() - started;
  ids.orderA = new URL(page.url()).pathname.split("/").pop()!;
  report.critere1 = { elapsedMs, viewport: "390 × 844", steps: ["Recommander", "Recommander (commande du " + LAST_WEEK + ")", "date", "Valider la commande"] };
  console.log(`[critère 1] recopie validée en ${(elapsedMs / 1000).toFixed(1)} s`);
  expect(elapsedMs).toBeLessThan(60_000);
  await expect(page.getByTestId(`order-line-${BAGUETTE}`)).toContainText("× 20");
  await shot(page, "v1-03-recopie-validee-mobile");

  // Reprise après rechargement : la commande est toujours là, au prix de A.
  await page.reload();
  await expect(page.getByText("Validée", { exact: true })).toBeVisible();
  await expect(page.getByTestId(`order-line-${BAGUETTE}`)).toContainText("1,05");

  // NOT-02 : « Commande validée » dans la cloche.
  await withPrisma(async (prisma) => {
    await expect.poll(async () => (await prisma.operationJob.findUnique({ where: { jobKey: `not02:${ids.orderA}:0:${ids.users.a}` } }))?.status, { timeout: 60_000 }).toBe("SUCCEEDED");
  });
  const menu = await openBell(page);
  await expect(menu.getByRole("menuitem").filter({ hasText: "Commande validée" })).toHaveCount(1);
  await shot(page, "v1-04-cloche-commande-validee-mobile");
  await page.keyboard.press("Escape");
});

test("Veille — critère 3 : A voit son prix spécifique, B le prix de base", async ({ browser }) => {
  for (const [key, price, specific] of [["a", "1,05", true], ["b", "1,20", false]] as const) {
    const context = key === "a" ? contexts.a! : await browser.newContext({ viewport: MOBILE, hasTouch: true, isMobile: true });
    const page = key === "a" ? pages.a! : await context.newPage();
    if (key === "a") await page.goto("/portal");
    else await login(page, account("b"), "/login/client", "/portal");
    await page.getByLabel("Rechercher un produit").fill(BAGUETTE);
    const row = page.getByTestId(`portal-product-${BAGUETTE}`);
    await expect(row.getByTestId("portal-product-price")).toContainText(price);
    await expect(row.getByText("Votre prix")).toHaveCount(specific ? 1 : 0);
    await shot(page, `v1-05-prix-client-${key}-mobile`);
    if (key !== "a") await context.close();
  }
  report.critere3 = { a: "1,05 € (Votre prix)", b: "1,20 € (prix de base)" };
});

test("Veille — C commande puis annule avant l'heure limite", async ({ browser }) => {
  const context = await browser.newContext({ viewport: MOBILE, hasTouch: true, isMobile: true });
  contexts.c = context;
  const page = await context.newPage();
  pages.c = page;
  watch(page, "client C");
  await login(page, account("c"), "/login/client", "/portal");
  await page.locator("#order-other-date").fill(D);
  await page.getByRole("radio", { name: "7h – 8h" }).click();
  await page.getByLabel("Rechercher un produit").fill(CROISSANT);
  await page.getByLabel(`Quantité de ${CROISSANT}`).fill("12");
  await page.getByLabel("Rechercher un produit").fill("");
  await page.getByRole("button", { name: "Voir le panier" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Valider la commande" }).click();
  await page.waitForURL(/\/portal\/orders\/[^/?]+/);
  ids.orderC = new URL(page.url()).pathname.split("/").pop()!;
  await page.getByRole("button", { name: "Annuler la commande" }).click();
  await page.getByRole("button", { name: "Annuler la commande" }).last().click();
  await expect(page.getByText("Annulée", { exact: true })).toBeVisible();
  await shot(page, "v1-06-annulee-avant-heure-limite-mobile");
  // Rechargement : l'annulation est bien enregistrée.
  await page.reload();
  await expect(page.getByText("Annulée", { exact: true })).toBeVisible();
});

test("Veille — critère 2 : l'heure limite passe ; modifiable juste avant, refusée par le serveur juste après ; NOT-01", async ({ request }) => {
  const timeline: Array<[string, string]> = [];
  const mark = (step: string) => timeline.push([step, new Date().toISOString()]);
  report.critere2Timeline = timeline;
  const admin = pages.admin!;
  await login(admin, account("admin"), "/login", "/dashboard");
  await admin.goto("/settings");
  await expect(admin.getByTestId("cutoff-time")).toHaveValue("23:59");
  mark("paramètres ouverts");
  // L'admin règle l'heure limite sur la minute qui suit (au moins 75 s devant nous).
  const cutoffAt = new Date(Math.ceil((Date.now() + 75_000) / 60_000) * 60_000);
  const cutoff = local(ZONE.orderZone, cutoffAt);
  expect(cutoff.date).toBe(addDays(D, -1));
  if (ZONE.orderZone.startsWith("Etc/")) {
    await withPrisma((prisma) => prisma.company.update({ where: { id: ids.company }, data: { cutoffTime: cutoff.hhmm } }));
  } else {
    await admin.getByTestId("cutoff-time").fill(cutoff.hhmm);
    await expect(admin.getByTestId("cutoff-time")).toHaveValue(cutoff.hhmm);
    await admin.getByTestId("cutoff-time").locator("xpath=ancestor::form").getByRole("button", { name: "Enregistrer" }).click();
    await expect(admin.getByText("Paramètres enregistrés")).toBeVisible();
    await shot(admin, "v1-07-admin-heure-limite");
    report.settingsFieldAfterSave = await admin.getByTestId("cutoff-time").inputValue();
  }
  mark("heure limite enregistrée");
  expect((await withPrisma((prisma) => prisma.company.findUniqueOrThrow({ where: { id: ids.company } }))).cutoffTime).toBe(cutoff.hhmm);

  // « 16h59 » : A modifie sa commande, le serveur accepte.
  const page = pages.a!;
  await page.goto(`/portal/orders/${ids.orderA}`);
  mark("commande de A ouverte");
  await page.getByRole("button", { name: "Modifier" }).click({ timeout: 20_000 });
  await page.waitForURL((url) => url.pathname === "/portal");
  await expect(page.getByTestId("existing-order-banner")).toBeVisible();
  await page.getByLabel("Rechercher un produit").fill(BAGUETTE);
  await page.getByLabel(`Quantité de ${BAGUETTE}`).fill("24");
  await page.getByRole("button", { name: "Voir le panier" }).click();
  const [accepted] = await Promise.all([
    page.waitForResponse((response) => response.url().includes("/api/portal/orders") && response.request().method() !== "GET"),
    page.getByRole("dialog").getByRole("button", { name: "Enregistrer les modifications" }).click(),
  ]);
  const acceptedAt = new Date();
  mark("modification acceptée");
  expect(accepted.ok()).toBe(true);
  expect(acceptedAt.getTime()).toBeLessThan(cutoffAt.getTime());
  await page.waitForURL(new RegExp(`/portal/orders/${ids.orderA}`));
  await expect(page.getByTestId(`order-line-${BAGUETTE}`)).toContainText("× 24");

  // NOT-01 : le cron des rappels (heure réelle) tombe dans la fenêtre ; C, qui a annulé, est prévenu.
  const reminders = await request.get("/api/cron/order-reminders", { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } });
  expect(reminders.status()).toBe(200);
  const remindersBody = (await reminders.json()) as { data: { windows: Array<{ companyId: string; date: string }> } };
  expect(remindersBody.data.windows).toContainEqual({ companyId: ids.company, date: D });

  // A rouvre la modification avant l'heure limite, puis enregistre juste après : refus du serveur.
  await page.getByRole("button", { name: "Modifier" }).click();
  await page.waitForURL((url) => url.pathname === "/portal");
  await page.getByLabel("Rechercher un produit").fill(BAGUETTE);
  await page.getByLabel(`Quantité de ${BAGUETTE}`).fill("30");
  await page.getByRole("button", { name: "Voir le panier" }).click();
  const openedAt = new Date();
  mark("panier rouvert");
  expect(openedAt.getTime()).toBeLessThan(cutoffAt.getTime());
  await shot(page, "v1-08-panier-ouvert-avant-heure-limite-mobile");
  while (Date.now() < cutoffAt.getTime() + 1_000) await page.waitForTimeout(250);
  const save = page.getByRole("dialog").getByRole("button", { name: "Enregistrer les modifications" });
  const uiAttempt = await Promise.all([
    page.waitForResponse((response) => response.url().includes("/api/portal/orders") && response.request().method() !== "GET", { timeout: 15_000 }).catch(() => null),
    save.click().catch(() => null),
  ]);
  const refusedAt = new Date();
  const uiResponse = uiAttempt[0];
  const uiBody = uiResponse ? await uiResponse.text() : "";
  await expect(page.getByText("L'heure limite est passée").first()).toBeVisible();
  await shot(page, "v1-09-refus-apres-heure-limite-mobile");
  // Même chose par l'API, sans l'interface : le refus vient du serveur.
  const direct = await page.request.put("/api/portal/orders", {
    data: { deliveryDate: D, slotId: ids.slot, lines: [{ productId: ids.products[BAGUETTE]!, quantity: 31 }] },
  });
  const directBody = await direct.text();
  expect(direct.status()).toBe(409);
  expect(directBody).toContain("DEADLINE_PASSED");
  const cancel = await page.request.post(`/api/portal/orders/${ids.orderA}/cancel`);
  expect(cancel.status()).toBe(409);
  const stored = await withPrisma((prisma) => prisma.orderLine.findFirstOrThrow({ where: { orderId: ids.orderA, productId: ids.products[BAGUETTE]! } }));
  expect(stored.quantityOrdered).toBe(24);
  // NOT-01 : C, qui a annulé, voit « Pensez à commander pour demain » dans sa cloche.
  await withPrisma(async (prisma) => {
    const key = `not01:${ids.merchants.c}:${D}:${ids.users.c}`;
    await expect.poll(async () => (await prisma.operationJob.findUnique({ where: { jobKey: key } }))?.status, { timeout: 60_000 }).toBe("SUCCEEDED");
    expect(await prisma.operationJob.count({ where: { companyId: ids.company, jobKey: { startsWith: "not01:" } } })).toBe(1);
  });
  const reminderMenu = await openBell(pages.c!);
  await expect(reminderMenu.getByRole("menuitem").filter({ hasText: "Pensez à commander pour demain" })).toHaveCount(1);
  await shot(pages.c!, "v1-09b-cloche-rappel-client-c-mobile");
  await pages.c!.keyboard.press("Escape");
  report.not01 = { client: "c", seul: true };

  report.critere2 = {
    zone: ZONE.orderZone,
    cutoff: cutoff.hhmm,
    cutoffUtc: cutoffAt.toISOString(),
    accepted: { at: acceptedAt.toISOString(), localTime: local(ZONE.orderZone, acceptedAt).hhmm, status: accepted.status(), secondsBeforeCutoff: Math.round((cutoffAt.getTime() - acceptedAt.getTime()) / 1000) },
    refusedUi: { at: refusedAt.toISOString(), status: uiResponse?.status() ?? "aucune requête", code: /DEADLINE_PASSED/.test(uiBody) ? "DEADLINE_PASSED" : uiBody.slice(0, 120) },
    refusedApi: { status: direct.status(), code: "DEADLINE_PASSED", cancel: cancel.status() },
    storedBaguette: stored.quantityOrdered,
  };
});

// ---------------------------------------------------------------------------
// La nuit : production et tournées
// ---------------------------------------------------------------------------

test("Nuit — critères 4 et 5 : verrouillage à l'ouverture de la production ; récurrentes ; totaux ; manquant ; préparée et retour arrière", async () => {
  const baker = pages.baker!;
  await login(baker, account("baker"), "/login", "/bakery");
  await baker.goto(`/bakery?date=${D}`);
  await expect(baker.getByTestId("production-state")).toContainText("verrouillées");
  await shot(baker, "v1-10-boulanger-totaux-tablette", true);

  const orders = await withPrisma((prisma) =>
    prisma.order.findMany({ where: { companyId: ids.company, deliveryDate: DB_D }, include: { lines: true, merchant: { select: { name: true } } }, orderBy: { createdAt: "asc" } })
  );
  const byMerchant = (key: MerchantKey) => orders.filter((order) => order.merchantId === ids.merchants[key]);
  // Critère 4 : B et Delta ont une commande générée ; A garde sa seule commande manuelle (récurrente remplacée).
  expect(byMerchant("a").map((order) => `${order.origin}:${order.status}`)).toEqual(["MANUAL:LOCKED"]);
  expect(byMerchant("a")[0]!.lines.some((line) => line.productId === ids.products[PAIN])).toBe(false);
  expect(byMerchant("b").map((order) => `${order.origin}:${order.status}`)).toEqual(["RECURRING:LOCKED"]);
  expect(byMerchant("d").map((order) => `${order.origin}:${order.status}`)).toEqual(["RECURRING:LOCKED"]);
  expect(byMerchant("c").map((order) => order.status)).toEqual(["CANCELLED"]);
  expect(orders.filter((order) => order.status !== "CANCELLED").every((order) => order.lines.every((line) => line.unitPriceFrozenCents !== null))).toBe(true);
  report.critere4 = Object.fromEntries((Object.keys(MERCHANTS) as MerchantKey[]).map((key) => [key, byMerchant(key).map((order) => `${order.origin}:${order.status}`)]));

  // Critère 5 : total affiché = somme des commandes non annulées du jour, pour chaque produit.
  const sums: Record<string, number> = {};
  for (const order of orders.filter((row) => row.status !== "CANCELLED")) {
    for (const line of order.lines) {
      const name = PRODUCTS.find((product) => ids.products[product.name] === line.productId)!.name;
      sums[name] = (sums[name] ?? 0) + line.quantityOrdered;
    }
  }
  for (const [name, sum] of Object.entries(sums)) await expect(baker.getByTestId(`total-${name}`)).toContainText(String(sum));
  report.critere5 = sums;

  // Manquant sur la baguette de A (20 livrées sur 24), puis « préparée », retour arrière et de nouveau « préparée ».
  await baker.getByRole("tab", { name: "Par client" }).click();
  const sheet = baker.getByTestId(`sheet-${MERCHANTS.a.name}`);
  await sheet.getByRole("button", { name: `Signaler un manquant sur ${BAGUETTE}` }).click();
  const dialog = baker.getByRole("dialog");
  await dialog.getByLabel("Livré").fill("20");
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await expect(baker.getByText("Manquant enregistré")).toBeVisible();
  await expect(sheet.getByTestId(`sheet-line-${BAGUETTE}`)).toContainText("20 / 24");
  const prepared = sheet.getByRole("button", { name: /Marquer préparée|Préparée/ });
  await prepared.click();
  await expect(prepared).toHaveAttribute("aria-pressed", "true");
  await prepared.click();
  await expect(prepared).toHaveAttribute("aria-pressed", "false");
  await baker.reload();
  await baker.getByRole("tab", { name: "Par client" }).click();
  await expect(baker.getByTestId(`sheet-${MERCHANTS.a.name}`).getByRole("button", { name: /Marquer préparée|Préparée/ })).toHaveAttribute("aria-pressed", "false");
  await baker.getByTestId(`sheet-${MERCHANTS.a.name}`).getByRole("button", { name: /Marquer préparée|Préparée/ }).click();
  await expect(baker.getByTestId(`sheet-${MERCHANTS.a.name}`).getByRole("button", { name: /Marquer préparée|Préparée/ })).toHaveAttribute("aria-pressed", "true");
  await shot(baker, "v1-11-boulanger-manquant-preparee-tablette", true);
  const preparedAt = await withPrisma((prisma) => prisma.order.findUniqueOrThrow({ where: { id: ids.orderA }, select: { preparedAt: true } }));
  expect(preparedAt.preparedAt).not.toBeNull();

  // Commande déjà verrouillée ouverte par le client : plus de « Modifier ».
  const client = pages.a!;
  await client.goto(`/portal/orders/${ids.orderA}`);
  await expect(client.getByText("Verrouillée", { exact: true }).or(client.getByText("Préparée", { exact: true })).first()).toBeVisible();
  await expect(client.getByRole("button", { name: "Modifier" })).toHaveCount(0);
  await expect(client.getByRole("button", { name: "Annuler la commande" })).toHaveCount(0);
  await shot(client, "v1-12-client-commande-verrouillee-mobile");
});

test("Nuit — critère 6 (1/2) : tournée générée automatiquement ; l'admin attribue et valide", async () => {
  const rounds = await withPrisma((prisma) =>
    prisma.round.findMany({ where: { companyId: ids.company, date: DB_D }, include: { stops: { orderBy: { sequence: "asc" }, include: { order: { select: { merchant: { select: { name: true } } } } } } } })
  );
  expect(rounds.length).toBeGreaterThanOrEqual(1);
  expect(rounds.flatMap((round) => round.stops).length).toBe(3);
  report.roundsGenerated = rounds.map((round) => ({ name: round.name, status: round.status, stops: round.stops.map((stop) => stop.order.merchant.name) }));
  const admin = pages.admin!;
  await admin.goto(`/dashboard/rounds?date=${D}`);
  for (const round of rounds) {
    const card = admin.locator(`[data-testid="admin-round"][data-round-name="${round.name}"]`);
    await card.getByRole("combobox", { name: `Livreur de ${round.name}` }).click();
    await admin.getByRole("option", { name: DRIVER_NAME }).click();
    await expect(card.getByRole("combobox", { name: `Livreur de ${round.name}` })).toHaveText(DRIVER_NAME);
  }
  await admin.getByTestId("admin-validate-rounds").click();
  for (const round of rounds) await expect(admin.locator(`[data-testid="admin-round"][data-round-name="${round.name}"]`).getByTestId("admin-round-status")).toHaveText("Validée");
  await shot(admin, "v1-13-admin-tournee-validee", true);
  report.roundName = rounds[0]!.name;
});

// ---------------------------------------------------------------------------
// Le jour J
// ---------------------------------------------------------------------------

test("Jour J — critère 6 (2/2) : l'admin déplace un arrêt, le livreur voit le nouvel ordre", async () => {
  await setCompanyZone(ZONE.deliverZone);
  const driver = pages.driver!;
  await login(driver, account("driver"), "/login/driver", "/driver");
  await expect(driver.getByTestId("driver-round-summary")).toContainText(report.roundName as string);
  const names = () => driver.getByTestId("driver-stops").getByTestId("driver-stop-name").allTextContents();
  const dbOrder = async () =>
    withPrisma(async (prisma) =>
      (await prisma.stop.findMany({ where: { companyId: ids.company }, orderBy: { sequence: "asc" }, include: { order: { select: { merchant: { select: { name: true } } } } } })).map((stop) => stop.order.merchant.name)
    );
  const before = await names();
  expect(before).toEqual(await dbOrder());
  await shot(driver, "v1-14-livreur-ordre-initial-mobile");

  const admin = pages.admin!;
  await admin.goto(`/dashboard/rounds?date=${D}`);
  await admin.getByRole("button", { name: `Descendre ${before[0]}` }).click();
  await expect(admin.getByText("Ordre enregistré")).toBeVisible();
  await driver.reload();
  await expect.poll(async () => (await names())[1]).toBe(before[0]);
  const after = await names();
  expect(after).toEqual(await dbOrder());
  expect(after).toEqual([before[1], before[0], before[2]]);
  await shot(driver, "v1-15-livreur-nouvel-ordre-mobile");
  report.critere6 = { before, after };
});

/** Tâches NOT-03 d'un arrêt et notifications « Livreur en approche » créées pour lui. */
async function approach(stopId: string) {
  return withPrisma(async (prisma) => {
    const jobs = await prisma.operationJob.findMany({ where: { jobKey: { startsWith: `not03:${stopId}:` } }, select: { status: true, createdAt: true, updatedAt: true } });
    const stop = await prisma.stop.findUniqueOrThrow({ where: { id: stopId }, select: { orderId: true } });
    const notifications = await prisma.clientNotification.count({ where: { companyId: ids.company, type: "APPROACH", href: { contains: stop.orderId } } });
    return { jobs, notifications };
  });
}

async function clientPage(key: "a" | "b") {
  if (pages[key]) return pages[key]!;
  const context = await contexts.a!.browser()!.newContext({ viewport: MOBILE, hasTouch: true, isMobile: true });
  contexts[key] = context;
  pages[key] = await context.newPage();
  watch(pages[key]!, `client ${key.toUpperCase()}`);
  await login(pages[key]!, account(key), "/login/client", "/portal");
  return pages[key]!;
}

async function expectApproachInBell(key: "a" | "b", name: string) {
  const page = await clientPage(key);
  await expect(async () => {
    const menu = await openBell(page);
    try {
      await expect(menu.getByRole("menuitem").filter({ hasText: "Livreur en approche" })).toHaveCount(1, { timeout: 10_000 });
    } catch (error) {
      await page.keyboard.press("Escape");
      throw error;
    }
  }).toPass({ timeout: 60_000 });
  await shot(page, name);
  await page.keyboard.press("Escape");
}

/** Arrêts tels qu'affichés au livreur : nom, statut, arrêt en cours, badge « en attente ». */
async function stopStates(page: Page) {
  return page.getByTestId("driver-stop").evaluateAll((rows) =>
    rows.map((row) => [row.querySelector('[data-testid="driver-stop-name"]')?.textContent, row.getAttribute("data-status"), row.getAttribute("aria-current") ? "en cours" : "", row.querySelector('[data-testid="driver-stop-pending"]') ? "en attente" : ""].join(":"))
  );
}

const keyOfMerchant = (merchantId: string) => (Object.keys(ids.merchants) as MerchantKey[]).find((key) => ids.merchants[key] === merchantId)!;

test("Jour J — critère 7 : démarrer, « Livré », arrêt suivant dans Plans en deux appuis ; NOT-03 au démarrage", async () => {
  const driver = pages.driver!;
  const stops = await withPrisma((prisma) => prisma.stop.findMany({ where: { companyId: ids.company }, orderBy: { sequence: "asc" }, include: { order: { select: { merchantId: true } } } }));
  const firstKey = keyOfMerchant(stops[0]!.order.merchantId);
  const startedAt = Date.now();
  await driver.getByTestId("driver-start").click();
  await expect(driver.getByTestId("driver-round-summary")).toContainText("En cours");
  // NOT-03 au démarrage : le client du premier arrêt est prévenu (temps mesuré avant de « rouler » jusqu'à lui).
  if (firstKey === "a" || firstKey === "b") {
    await expect.poll(async () => (await approach(stops[0]!.id)).jobs.map((job) => job.status).join(), { timeout: 60_000 }).toBe("SUCCEEDED");
    const state = await approach(stops[0]!.id);
    report.not03Start = { client: firstKey, jobDoneMs: state.jobs[0]!.updatedAt.getTime() - startedAt, notifications: state.notifications };
    expect(state.notifications).toBe(1);
    await expectApproachInBell(firstKey, `v1-18-cloche-livreur-en-approche-${firstKey}-mobile`);
  }

  const current = driver.locator('[data-testid="driver-stop"][aria-current="step"]');
  const first = (await current.getByTestId("driver-stop-name").textContent())!;
  await current.getByTestId("driver-delivered").click();
  let taps = 0;
  const dialog = driver.getByTestId("driver-next-dialog");
  await expect(dialog.getByTestId("driver-next-stop")).toBeVisible();
  await shot(driver, "v1-16-livreur-arret-suivant-mobile");
  await dialog.getByTestId("driver-go-next").click();
  taps += 1;
  await expect(dialog.getByTestId("driver-nav-menu")).toBeVisible();
  const waze = await dialog.getByTestId("driver-open-waze").getAttribute("href");
  await shot(driver, "v1-17-livreur-plans-waze-mobile");
  const [popup] = await Promise.all([driver.waitForEvent("popup"), dialog.getByTestId("driver-open-plans").click()]);
  taps += 1;
  const plansUrl = popup.url();
  await popup.close();
  expect(taps).toBe(2);
  expect(plansUrl).toMatch(/^https:\/\/maps\.apple\.com\/\?daddr=48\.\d+,2\.\d+&dirflg=d$/);
  expect(waze).toMatch(/^https:\/\/waze\.com\/ul\?ll=48\.\d+,2\.\d+&navigate=yes$/);
  report.critere7 = { taps, plansUrl, waze, delivered: first };
  // Le client de l'arrêt suivant est prévenu à son tour (tâche traitée avant de rouler jusqu'à lui).
  await expect.poll(async () => (await approach(stops[1]!.id)).jobs.every((job) => job.status === "SUCCEEDED"), { timeout: 60_000 }).toBe(true);
});

test("Jour J — critère 8 : « Livré » hors réseau, rechargement hors réseau, puis visible chez l'admin au retour", async () => {
  const driver = pages.driver!;
  const current = driver.locator('[data-testid="driver-stop"][aria-current="step"]');
  const name = (await current.getByTestId("driver-stop-name").textContent())!;
  const statusOf = async () =>
    withPrisma(async (prisma) => (await prisma.stop.findFirst({ where: { companyId: ids.company, order: { merchant: { name } } }, select: { status: true } }))?.status);

  // Livré hors réseau, à 2 / 3 avant le retour.
  await contexts.driver!.setOffline(true);
  await current.getByTestId("driver-delivered").click();
  await expect(driver.getByTestId("driver-next-dialog")).toBeVisible();
  await driver.getByTestId("driver-next-dialog").getByRole("button", { name: "Fermer" }).first().click();
  await expect(driver.getByTestId("driver-pending-count")).toHaveText("1 action en attente de synchronisation");
  await shot(driver, "v1-19-livreur-hors-reseau-mobile", true);
  report.beforeOfflineReload = await stopStates(driver);
  expect(await statusOf()).toBe("PENDING");

  // Reprise : rechargement sans réseau (copie du service worker du build de production).
  let offlineReload = "ok";
  try {
    await driver.reload({ timeout: 20_000 });
    await expect(driver.getByTestId("driver-round-summary")).toBeVisible({ timeout: 20_000 });
    await expect(driver.getByTestId("driver-pending-count")).toHaveText("1 action en attente de synchronisation", { timeout: 20_000 });
    await shot(driver, "v1-20-livreur-recharge-hors-reseau-mobile", true);
    report.afterOfflineReload = await stopStates(driver);
  } catch (error) {
    offlineReload = `échec : ${(error as Error).message.split("\n")[0]}`;
    await shot(driver, "v1-20-livreur-recharge-hors-reseau-echec-mobile");
  }
  expect(await statusOf()).toBe("PENDING");

  const admin = pages.admin!;
  await admin.goto("/dashboard");
  const live = admin.locator(`[data-testid="live-round"][data-round-name="${report.roundName as string}"]`);
  await expect(live.getByTestId("live-round-progress")).toHaveText("1 / 3 livrés");

  const backOnline = Date.now();
  await contexts.driver!.setOffline(false);
  if (offlineReload !== "ok") await driver.reload();
  await expect.poll(statusOf, { timeout: 60_000 }).toBe("DELIVERED");
  const syncedMs = Date.now() - backOnline;
  await expect(driver.getByTestId("driver-pending-count")).toHaveCount(0, { timeout: 30_000 });
  await expect.poll(async () => {
    await admin.reload();
    return live.getByTestId("live-round-progress").textContent();
  }, { timeout: 60_000 }).toBe("2 / 3 livrés");
  await shot(admin, "v1-21-admin-suivi-apres-retour-reseau", true);
  report.critere8 = { stop: name, offlineStatus: "PENDING", offlineReload, syncedMs, admin: "2 / 3 livrés" };
  // NOT-03 après le « Livré » rejoué : le client du dernier arrêt est prévenu.
  const last = await withPrisma((prisma) => prisma.stop.findFirstOrThrow({ where: { companyId: ids.company, status: "PENDING" }, include: { order: { select: { merchantId: true } } } }));
  const lastKey = keyOfMerchant(last.order.merchantId);
  if (lastKey === "a" || lastKey === "b") {
    await expect.poll(async () => (await approach(last.id)).notifications, { timeout: 60_000 }).toBe(1);
    await expectApproachInBell(lastKey, `v1-20b-cloche-approche-apres-hors-reseau-${lastKey}-mobile`);
    report.not03AfterOffline = { client: lastKey };
  }
  expect(offlineReload).toBe("ok");

  // Dernier arrêt livré en ligne : tournée terminée.
  await driver.locator('[data-testid="driver-stop"][aria-current="step"]').getByTestId("driver-delivered").click();
  await driver.getByTestId("driver-next-dialog").getByRole("button", { name: "Fermer" }).first().click().catch(() => undefined);
  await expect(driver.getByTestId("driver-round-summary")).toContainText("Terminée", { timeout: 30_000 });
  await shot(driver, "v1-22-livreur-termine-mobile");
});

test("Jour J — critère 9 : l'admin facture A ; le manquant réduit la facture ; A la voit dans son portail", async () => {
  const admin = pages.admin!;
  await admin.goto("/dashboard/invoices");
  await expect(admin.getByRole("heading", { name: "Factures" })).toBeVisible();
  await admin.getByTestId("open-generate").click();
  const dialog = admin.getByRole("dialog");
  await dialog.getByRole("combobox", { name: "Périodicité" }).click();
  await admin.getByRole("option", { name: "Jour", exact: true }).click();
  await dialog.getByLabel("Jour compris dans la période").fill(D);
  await dialog.getByRole("combobox", { name: "Client" }).click();
  await admin.getByRole("option", { name: MERCHANTS.a.name }).click();
  await dialog.getByRole("button", { name: "Générer les factures" }).click();
  await expect(dialog.getByTestId("generate-result")).toContainText("1 facture créée");
  await dialog.getByRole("button", { name: "Fermer" }).first().click();

  const { invoice, lines } = await withPrisma(async (prisma) => ({
    invoice: await prisma.invoice.findFirstOrThrow({ where: { companyId: ids.company, merchantId: ids.merchants.a } }),
    lines: await prisma.orderLine.findMany({ where: { orderId: ids.orderA } }),
  }));
  ids.invoice = invoice.id;
  ids.invoiceRef = invoice.reference;
  const ordered = lines.reduce((sum, line) => sum + line.quantityOrdered * line.unitPriceFrozenCents!, 0);
  const delivered = lines.reduce((sum, line) => sum + (line.quantityDelivered ?? line.quantityOrdered) * line.unitPriceFrozenCents!, 0);
  expect(invoice.subtotalCents).toBe(delivered);
  expect(ordered - delivered).toBe(4 * SPECIFIC_CENTS);
  report.critere9 = { reference: invoice.reference, orderedHT: ordered, invoicedHT: invoice.subtotalCents, ttc: invoice.totalCents, missing: `4 × ${BAGUETTE} à ${SPECIFIC_CENTS} c` };

  await admin.goto("/dashboard/invoices");
  await admin.getByTestId(`invoice-row-${invoice.reference}`).getByRole("link", { name: invoice.reference }).click();
  await expect(admin.getByTestId("invoice-reference")).toHaveText(invoice.reference);
  await expect(admin.getByTestId(`invoice-line-${BAGUETTE}`)).toContainText("20");
  await shot(admin, "v1-23-admin-facture", true);

  const client = pages.a!;
  await client.goto("/portal/invoices");
  await expect(client.getByTestId(`portal-invoice-${invoice.reference}`)).toBeVisible();
  await shot(client, "v1-24-client-factures-mobile");
});

test("Critère 10 : un utilisateur de A ne voit rien de B (démo), et réciproquement", async ({ browser }) => {
  const demo = await withPrisma(async (prisma) => ({
    merchant: (await prisma.merchant.findFirstOrThrow({ where: { companyId: DEMO_COMPANY }, select: { id: true } })).id,
    order: (await prisma.order.findFirstOrThrow({ where: { companyId: DEMO_COMPANY }, select: { id: true } })).id,
  }));
  const status = async (page: Page, url: string) => (await page.request.get(url)).status();
  const text = async (page: Page, url: string) => (await page.request.get(url)).text();

  const fromA = {
    adminDemoMerchant: await status(pages.admin!, `/api/merchants/${demo.merchant}`),
    adminMerchantsHaveDemo: (await text(pages.admin!, "/api/merchants")).includes("(démo)"),
    adminProducts: ((await (await pages.admin!.request.get("/api/catalog/products")).json()) as { data: unknown[] }).data.length,
    clientDemoOrder: await status(pages.a!, `/api/portal/orders/${demo.order}`),
    bakerProductionHasDemo: (await text(pages.baker!, `/api/production?date=${D}`)).includes("(démo)"),
    driverRoundsHaveDemo: (await text(pages.driver!, "/api/driver/rounds")).includes("(démo)"),
  };
  await pages.admin!.goto("/dashboard/merchants");
  await expect(pages.admin!.getByTestId("merchant-row")).toHaveCount(4);
  await shot(pages.admin!, "v1-25-admin-a-clients");

  const demoAdminContext = await browser.newContext({ viewport: DESKTOP });
  const demoAdmin = await demoAdminContext.newPage();
  watch(demoAdmin, "admin démo");
  await login(demoAdmin, accounts!.admin!, "/login", "/dashboard");
  const demoClientContext = await browser.newContext({ viewport: MOBILE, hasTouch: true, isMobile: true });
  const demoClient = await demoClientContext.newPage();
  watch(demoClient, "client démo");
  await login(demoClient, accounts!["client-1"]!, "/login/client", "/portal");
  const fromB = {
    adminMerchantA: await status(demoAdmin, `/api/merchants/${ids.merchants.a}`),
    adminMerchantsHaveA: (await text(demoAdmin, "/api/merchants")).includes(TAG),
    adminInvoiceA: await status(demoAdmin, `/api/invoices/${ids.invoice}`),
    clientOrderA: await status(demoClient, `/api/portal/orders/${ids.orderA}`),
    clientInvoiceA: await status(demoClient, `/api/portal/invoices/${ids.invoice}`),
  };
  // Liste des clients (et non les commandes du jour : leur ouverture verrouillerait une date échue de la démo).
  await demoAdmin.goto("/dashboard/merchants");
  await expect(demoAdmin.getByTestId("merchant-row").first()).toBeVisible();
  await expect(demoAdmin.getByText(TAG)).toHaveCount(0);
  await shot(demoAdmin, "v1-26-admin-b-sans-donnees-a");
  await demoAdminContext.close();
  await demoClientContext.close();
  report.critere10 = { fromA, fromB };
  expect(fromA).toEqual({ adminDemoMerchant: 404, adminMerchantsHaveDemo: false, adminProducts: 3, clientDemoOrder: 404, bakerProductionHasDemo: false, driverRoundsHaveDemo: false });
  expect(fromB.adminMerchantA).toBe(404);
  expect(fromB.adminMerchantsHaveA).toBe(false);
  expect([403, 404]).toContain(fromB.adminInvoiceA);
  expect(fromB.clientOrderA).toBe(404);
  expect([403, 404]).toContain(fromB.clientInvoiceA);
});

test("Passe sombre et tablette : portail, livreur, boulanger, back-office", async ({ browser }) => {
  const screens: Array<[string, string, string]> = [
    ["portail", "a", "/portal"],
    ["livreur", "driver", "/driver"],
    ["boulanger", "baker", `/bakery?date=${D}`],
    ["back-office", "admin", `/dashboard/orders?date=${D}`],
  ];
  const findings: Record<string, unknown> = {};
  for (const [label, key, path] of screens) {
    // Tablette (1024 × 768, tactile) en sombre, avec la session déjà ouverte du rôle.
    const context = await browser.newContext({ viewport: TABLET, hasTouch: true, colorScheme: "dark", storageState: await contexts[key]!.storageState() });
    const page = await context.newPage();
    watch(page, `${label} sombre`);
    await page.goto(path);
    await page.waitForLoadState("networkidle").catch(() => undefined);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    findings[`${label}-tablette`] = await page.evaluate(() => ({
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
      background: getComputedStyle(document.body).backgroundColor,
    }));
    await shot(page, `v1-sombre-${label}-tablette`, true);
    await context.close();
  }
  // Téléphone : thème clair seul (décision du propriétaire du 30 octobre 2026), même si le système est sombre.
  for (const [label, key, path] of screens.slice(0, 2)) {
    const page = pages[key]!;
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto(path);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    findings[`${label}-mobile`] = "clair (téléphone)";
    await page.emulateMedia({ colorScheme: "light" });
  }
  report.darkTablet = findings;
  for (const value of Object.values(findings)) if (typeof value === "object") expect((value as { overflowX: boolean }).overflowX).toBe(false);
});
