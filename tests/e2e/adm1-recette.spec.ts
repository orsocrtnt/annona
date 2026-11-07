/**
 * Recette navigateur ADM-1 sur annona-dev (comptes de démo de `npm run db:seed`) : ADM-01, ADM-03, ADM-09,
 * PLA-02, PLA-03, critère 10.
 *   E2E_BASE_URL=http://localhost:3250 E2E_SKIP_WEB_SERVER=1 npx playwright test tests/e2e/adm1-recette.spec.ts
 *
 * Parcours : l'admin crée un client (adresse géocodée par la base nationale, repère déplacé sur la carte), un
 * prix spécifique et un compte client rattaché ; il ajoute un créneau, change l'heure limite et envoie un
 * logo ; le client (invitation acceptée simulée : mot de passe posé par l'API d'administration Supabase, les
 * e-mails d'invitation n'étant pas configurés en développement) voit le nom et le logo de la boulangerie dans
 * son portail ; l'admin désactive ce compte : le client est déconnecté et sa connexion refusée. Le
 * super-administrateur crée l'entreprise B avec son administrateur, la configure, la suspend (connexion de
 * l'admin de B refusée) puis la réactive ; l'admin de B ne voit rien de A (écrans vides, identifiants de A en 404).
 * Données « E2E-ADM1 » supprimées à la fin et vérifiées (comptes Supabase Auth et entreprise B compris) ;
 * heure limite, réglages et logo de la démo restaurés. Captures : outputs/recette-notif1-adm1/.
 */
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { Prisma, PrismaClient } from "@prisma/client";
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
const SHOTS = resolve("outputs/recette-notif1-adm1");
const COMPANY = "demo_company_boulangerie";
const TAG = "E2E-ADM1";
const MERCHANT_NAME = `${TAG} Café Recette`;
const CLIENT_EMAIL = "e2e-adm1-client@example.com";
const ADMIN_B_EMAIL = "e2e-adm1-admin-b@example.com";
const COMPANY_B = `${TAG} Boulangerie B`;
const PASSWORD = `E2e-${randomBytes(9).toString("base64url")}`;
const STARTED_AT = new Date();
const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

test.describe.configure({ mode: "serial", timeout: 300_000 });
test.skip(!accounts, "outputs/comptes-demo.json absent : lancer npm run db:seed sur annona-dev");

const consoleErrors: string[] = [];
const report: Record<string, unknown> = {};
let original: { cutoffTime: string; timezone: string; reminderLeadMinutes: number; name: string; settings: Prisma.JsonValue; logoUrl: string | null } | null = null;
let adminContext: BrowserContext;
let clientContext: BrowserContext;
let rootContext: BrowserContext;
let admin: Page;

function supabaseAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

function watch(page: Page, label: string) {
  page.on("console", (message) => {
    // Refus attendus pendant la recette (connexion refusée, session coupée) : 401 / 403 / 404.
    if (message.type() === "error" && !/status of 40[134]/.test(message.text())) consoleErrors.push(`${label} : ${message.text().slice(0, 300)}`);
  });
  page.on("pageerror", (error) => consoleErrors.push(`${label} (exception) : ${error.message.slice(0, 300)}`));
}

async function login(page: Page, account: Account, path: string, home: string) {
  await page.goto(path);
  await page.locator('input[type="email"]').fill(account.email);
  await page.locator('input[name="password"]').fill(account.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL((url) => url.pathname.startsWith(home), { timeout: 60_000 });
}

/** Invitation acceptée (simulée) : mot de passe posé côté Supabase, compte activé comme le ferait le lien. */
async function acceptInvitation(prisma: PrismaClient, email: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const { error } = await supabaseAdmin().auth.admin.updateUserById(user.authId, { password: PASSWORD, email_confirm: true });
  if (error) throw new Error(`Supabase : ${error.message}`);
  await prisma.user.update({ where: { id: user.id }, data: { status: "ACTIVE" } });
}

async function cleanup() {
  const prisma = new PrismaClient();
  try {
    const merchants = await prisma.merchant.findMany({ where: { companyId: COMPANY, name: { startsWith: TAG } }, select: { id: true } });
    const merchantIds = merchants.map((row) => row.id);
    const users = await prisma.user.findMany({ where: { email: { in: [CLIENT_EMAIL, ADMIN_B_EMAIL] } }, select: { id: true, authId: true } });
    await prisma.clientNotification.deleteMany({ where: { userId: { in: users.map((row) => row.id) } } });
    await prisma.merchantPrice.deleteMany({ where: { merchantId: { in: merchantIds } } });
    await prisma.user.deleteMany({ where: { id: { in: users.map((row) => row.id) } } });
    await prisma.merchant.deleteMany({ where: { id: { in: merchantIds } } });
    await prisma.slot.deleteMany({ where: { companyId: COMPANY, label: TAG } });
    const companiesB = await prisma.company.findMany({ where: { name: COMPANY_B }, select: { id: true } });
    await prisma.user.deleteMany({ where: { companyId: { in: companiesB.map((row) => row.id) } } });
    await prisma.company.deleteMany({ where: { id: { in: companiesB.map((row) => row.id) } } });
    // Journal de la recette dans l'entreprise de démo (fiche client, comptes, paramètres).
    await prisma.auditLog.deleteMany({
      where: { companyId: COMPANY, createdAt: { gte: STARTED_AT }, entityType: { in: ["Merchant", "User", "CompanySettings"] } },
    });
    if (original) {
      await prisma.company.update({
        where: { id: COMPANY },
        data: { cutoffTime: original.cutoffTime, timezone: original.timezone, reminderLeadMinutes: original.reminderLeadMinutes, name: original.name, settings: original.settings ?? Prisma.DbNull },
      });
    }
    const supabase = supabaseAdmin();
    const listed = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    for (const found of (listed.data?.users ?? []).filter((user) => [CLIENT_EMAIL, ADMIN_B_EMAIL].includes(user.email ?? ""))) {
      await supabase.auth.admin.deleteUser(found.id);
    }
  } finally {
    await prisma.$disconnect();
  }
}

test.beforeAll(async ({ browser }: { browser: Browser }) => {
  mkdirSync(SHOTS, { recursive: true });
  const prisma = new PrismaClient();
  try {
    original = await prisma.company.findUniqueOrThrow({
      where: { id: COMPANY },
      select: { cutoffTime: true, timezone: true, reminderLeadMinutes: true, name: true, settings: true, logoUrl: true },
    });
    if (original.logoUrl) throw new Error("La démo a déjà un logo : la recette le remplacerait. Arrêt.");
  } finally {
    await prisma.$disconnect();
  }
  await cleanup();
  adminContext = await browser.newContext({ viewport: DESKTOP });
  clientContext = await browser.newContext({ viewport: MOBILE, hasTouch: true, isMobile: true });
  rootContext = await browser.newContext({ viewport: DESKTOP });
  admin = await adminContext.newPage();
  watch(admin, "admin");
});

test.afterAll(async () => {
  // Logo de la démo retiré par l'API (stockage compris) avant de fermer la session de l'admin.
  if (admin && original && !original.logoUrl) {
    const removed = await admin.request.delete("/api/company/logo").catch(() => null);
    report.logoRemoved = removed?.status() ?? "échec";
  }
  await adminContext?.close();
  await clientContext?.close();
  await rootContext?.close();
  await cleanup();
  const prisma = new PrismaClient();
  try {
    const listed = await supabaseAdmin().auth.admin.listUsers({ page: 1, perPage: 1000 });
    const company = await prisma.company.findUniqueOrThrow({ where: { id: COMPANY }, select: { cutoffTime: true, timezone: true, reminderLeadMinutes: true, name: true, logoUrl: true } });
    const left = {
      merchants: await prisma.merchant.count({ where: { name: { startsWith: TAG } } }),
      users: await prisma.user.count({ where: { email: { in: [CLIENT_EMAIL, ADMIN_B_EMAIL] } } }),
      authUsers: (listed.data?.users ?? []).filter((user) => [CLIENT_EMAIL, ADMIN_B_EMAIL].includes(user.email ?? "")).length,
      companiesB: await prisma.company.count({ where: { name: COMPANY_B } }),
      slots: await prisma.slot.count({ where: { companyId: COMPANY, label: TAG } }),
      journal: await prisma.auditLog.count({ where: { companyId: COMPANY, createdAt: { gte: STARTED_AT }, entityType: { in: ["Merchant", "User", "CompanySettings"] } } }),
      demoSettings: company.cutoffTime === original!.cutoffTime && company.timezone === original!.timezone && company.reminderLeadMinutes === original!.reminderLeadMinutes && company.name === original!.name,
      demoLogo: company.logoUrl,
    };
    report.leftovers = left;
    expect(left).toEqual({ merchants: 0, users: 0, authUsers: 0, companiesB: 0, slots: 0, journal: 0, demoSettings: true, demoLogo: null });
  } finally {
    await prisma.$disconnect();
  }
  report.consoleErrors = consoleErrors;
  console.log(`[ADM-1] rapport ${JSON.stringify(report)}`);
});

test("ADM-1 clients : création avec adresse géocodée et position ajustée, prix spécifique, compte client rattaché", async () => {
  await login(admin, accounts!.admin!, "/login", "/dashboard");
  await admin.goto("/dashboard/merchants");
  await expect(admin.getByRole("heading", { name: "Clients" })).toBeVisible();
  await expect(admin.getByTestId("merchant-row").first()).toBeVisible();
  await admin.screenshot({ path: `${SHOTS}/adm1-01-clients.png` });
  await admin.getByRole("link", { name: "Nouveau client" }).click();
  await admin.waitForURL(/\/dashboard\/merchants\/new$/);
  const form = admin.getByTestId("merchant-form");
  await form.getByLabel("Raison sociale").fill(MERCHANT_NAME);
  await form.getByLabel(/Adresse de livraison/).fill("10 rue de Rivoli Paris");
  const suggestion = admin.getByRole("option").first();
  await expect(suggestion).toBeVisible({ timeout: 30_000 });
  await suggestion.click();
  const picker = admin.getByTestId("position-picker");
  await expect(picker).toBeVisible({ timeout: 30_000 });
  const geocoded = await admin.getByTestId("position-coordinates").textContent();
  // Position modifiable : un clic sur la carte déplace le repère.
  await picker.scrollIntoViewIfNeeded();
  await admin.waitForTimeout(800); // fin du recentrage animé de la carte
  const box = (await picker.locator(".leaflet-container").boundingBox())!;
  await admin.mouse.click(box.x + box.width / 2 + 60, box.y + box.height / 2 + 30);
  await expect(admin.getByTestId("position-coordinates")).not.toHaveText(geocoded!);
  const adjusted = await admin.getByTestId("position-coordinates").textContent();
  await form.getByLabel("Consignes d'accès").fill("Code 4521, porte de service");
  await form.getByLabel("Nom du contact").fill("Léa Recette");
  await form.getByRole("combobox", { name: "Périodicité de facturation" }).click();
  await admin.getByRole("option", { name: "Semaine" }).click();
  await admin.screenshot({ path: `${SHOTS}/adm1-02-nouveau-client-carte.png`, fullPage: true });
  await admin.getByTestId("merchant-submit").click();
  await admin.waitForURL(/\/dashboard\/merchants\/(?!new)[^/]+$/);
  const prisma = new PrismaClient();
  try {
    const merchant = await prisma.merchant.findFirstOrThrow({ where: { companyId: COMPANY, name: MERCHANT_NAME } });
    expect(merchant.latitude).not.toBeNull();
    expect(`${merchant.latitude!.toFixed(5)}, ${merchant.longitude!.toFixed(5)}`).toBe(adjusted);
    expect(merchant.billingPeriod).toBe("WEEKLY");
    expect(merchant.accessInstructions).toBe("Code 4521, porte de service");
    report.merchant = { geocoded, adjusted, city: merchant.city };

    // ADM-03 depuis la fiche client.
    await admin.getByRole("combobox", { name: "Produit" }).click();
    await admin.getByRole("option", { name: "Croissant au beurre" }).click();
    await admin.getByLabel("Prix HT (€)").fill("0,95");
    await admin.getByRole("button", { name: "Ajouter le prix" }).click();
    await expect(admin.getByTestId("merchant-price-list")).toContainText("Croissant au beurre");
    await expect(admin.getByTestId("merchant-price-list")).toContainText("0,95");

    // ADM-01 : compte client rattaché à ce client (SCHEMA-1 corrigé).
    await admin.getByRole("button", { name: "Créer un compte" }).click();
    const dialog = admin.getByRole("dialog");
    await dialog.getByRole("textbox", { name: "Prénom (obligatoire)", exact: true }).fill("Léa");
    await dialog.getByRole("textbox", { name: "Nom (obligatoire)", exact: true }).fill("Recette");
    await dialog.getByLabel("Adresse e-mail").fill(CLIENT_EMAIL);
    await dialog.getByRole("button", { name: "Envoyer l’invitation" }).click();
    await expect(dialog).toBeHidden();
    await expect(admin.getByTestId("merchant-user").filter({ hasText: CLIENT_EMAIL })).toBeVisible();
    const user = await prisma.user.findUniqueOrThrow({ where: { email: CLIENT_EMAIL }, include: { role: true } });
    expect([user.merchantId, user.companyId, user.role.systemRole, user.status]).toEqual([merchant.id, COMPANY, "MERCHANT", "PENDING_VERIFICATION"]);
    await admin.screenshot({ path: `${SHOTS}/adm1-03-fiche-client.png`, fullPage: true });
  } finally {
    await prisma.$disconnect();
  }
});

test("ADM-09, PLA-03 : créneau ajouté puis désactivé, heure limite modifiée, logo envoyé et visible dans le portail du client", async () => {
  await admin.goto("/settings");
  await expect(admin.getByRole("heading", { name: "Paramètres" })).toBeVisible();
  // Créneau.
  const slots = admin.getByTestId("slot-list");
  await admin.getByRole("textbox", { name: "Nom (facultatif)" }).last().fill(TAG);
  await admin.getByTestId("new-slot-start").fill("04:00");
  await admin.getByTestId("new-slot-end").fill("04:30");
  await admin.getByRole("button", { name: "Ajouter le créneau" }).click();
  const slot = slots.locator(`[data-testid="slot-row"][data-slot="${TAG}"]`);
  await expect(slot).toBeVisible();
  await slot.getByRole("switch", { name: `Désactiver ${TAG}` }).click();
  await expect(slot.getByText("Désactivé")).toBeVisible();
  // Heure limite.
  await expect(admin.getByTestId("company-name")).toHaveValue(original!.name);
  await admin.getByTestId("cutoff-time").fill("16:30");
  await admin.getByTestId("ordering-save").click();
  await expect(admin.getByText("Paramètres enregistrés").first()).toBeVisible();
  // Logo.
  const png = await sharp({ create: { width: 256, height: 256, channels: 4, background: { r: 196, g: 120, b: 36, alpha: 1 } } }).png().toBuffer();
  await admin.locator('input[type="file"]').first().setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: png });
  await expect(admin.getByText("Retirer le logo")).toBeVisible({ timeout: 30_000 });
  await admin.screenshot({ path: `${SHOTS}/adm1-04-parametres.png`, fullPage: true });
  const prisma = new PrismaClient();
  try {
    const company = await prisma.company.findUniqueOrThrow({ where: { id: COMPANY }, select: { cutoffTime: true, logoUrl: true } });
    expect(company.cutoffTime).toBe("16:30");
    expect(company.logoUrl).not.toBeNull();
    const created = await prisma.slot.findFirstOrThrow({ where: { companyId: COMPANY, label: TAG } });
    expect([created.startTime, created.endTime, created.active]).toEqual(["04:00", "04:30", false]);
    await acceptInvitation(prisma, CLIENT_EMAIL);
  } finally {
    await prisma.$disconnect();
  }
  // PLA-03 : nom et logo de la boulangerie dans le portail du client.
  const client = await clientContext.newPage();
  watch(client, "client");
  await login(client, { email: CLIENT_EMAIL, password: PASSWORD }, "/login/client", "/portal");
  const brand = client.getByTestId("company-brand");
  await expect(brand).toContainText(original!.name);
  await expect(brand.getByTestId("company-logo")).toBeVisible();
  await expect.poll(() => brand.getByTestId("company-logo").evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth), { timeout: 30_000 }).toBeGreaterThan(0);
  await client.screenshot({ path: `${SHOTS}/adm1-05-portail-logo-mobile.png` });
  report.pla03 = "nom et logo visibles";
});

test("ADM-01 : l'admin désactive le compte client ; session coupée et connexion refusée", async () => {
  await admin.goto("/users");
  await admin.getByPlaceholder("Rechercher un compte...").fill("Léa Recette");
  await admin.getByRole("button", { name: "Désactiver Léa Recette" }).click();
  await expect(admin.getByText("Compte désactivé : connexion refusée.")).toBeVisible();
  await admin.screenshot({ path: `${SHOTS}/adm1-06-compte-desactive.png` });
  const client = clientContext.pages()[0]!;
  // Appel d'API avec la session existante : refusé dès la requête suivante.
  const api = await client.request.get("/api/portal/orders?scope=upcoming");
  expect([401, 403]).toContain(api.status());
  await client.reload();
  await client.waitForURL((url) => url.pathname.startsWith("/login"), { timeout: 60_000 });
  await clientContext.clearCookies();
  await client.goto("/login/client");
  await client.locator('input[type="email"]').fill(CLIENT_EMAIL);
  await client.locator('input[name="password"]').fill(PASSWORD);
  await client.getByRole("button", { name: "Se connecter" }).click();
  await expect(client.getByText("Compte ou entreprise indisponible. Contactez votre administrateur.")).toBeVisible();
  await client.screenshot({ path: `${SHOTS}/adm1-07-connexion-refusee-mobile.png` });
  report.adm01 = { api: api.status(), login: "refusée" };
});

test("PLA-02, critère 10 : le super-administrateur crée B, la configure, la suspend puis la réactive ; l'admin de B ne voit rien de A", async () => {
  const root = await rootContext.newPage();
  watch(root, "super-admin");
  await login(root, accounts!["super-admin"]!, "/login", "/admin");
  await root.goto("/companies");
  await root.getByRole("button", { name: "Nouvelle entreprise" }).click();
  const dialog = root.getByRole("dialog");
  await dialog.getByLabel("Nom de l'entreprise").fill(COMPANY_B);
  await dialog.getByRole("textbox", { name: "Prénom de l'administrateur (obligatoire)", exact: true }).fill("Bruno");
  await dialog.getByRole("textbox", { name: "Nom de l'administrateur (obligatoire)", exact: true }).fill("Bé");
  await dialog.getByLabel("E-mail de l'administrateur").fill(ADMIN_B_EMAIL);
  await dialog.getByRole("button", { name: "Créer l'entreprise" }).click();
  await root.waitForURL(/\/companies\/[^/]+$/);
  await expect(root.getByRole("heading", { name: COMPANY_B })).toBeVisible();
  await expect(root.getByTestId("company-config")).toHaveAttribute("aria-busy", "false");
  await root.getByLabel("Heure limite", { exact: true }).fill("18:00");
  await root.getByRole("button", { name: "Enregistrer" }).click();
  await expect(root.getByText("Configuration enregistrée")).toBeVisible();
  const companyId = new URL(root.url()).pathname.split("/").pop()!;
  const prisma = new PrismaClient();
  let merchantA = "";
  try {
    const companyB = await prisma.company.findUniqueOrThrow({ where: { id: companyId }, include: { slots: true } });
    expect([companyB.status, companyB.cutoffTime, companyB.slots.length]).toEqual(["ACTIVE", "18:00", 3]);
    await acceptInvitation(prisma, ADMIN_B_EMAIL);
    merchantA = (await prisma.merchant.findFirstOrThrow({ where: { companyId: COMPANY, name: MERCHANT_NAME } })).id;
  } finally {
    await prisma.$disconnect();
  }
  await root.screenshot({ path: `${SHOTS}/adm1-08-entreprise-b.png`, fullPage: true });

  // Suspension : plus aucun accès pour ses utilisateurs.
  await root.getByRole("button", { name: "Suspendre l'entreprise" }).click();
  await root.getByRole("dialog").getByRole("button", { name: "Suspendre l'entreprise" }).click();
  await expect(root.getByRole("button", { name: "Rétablir" })).toBeVisible();
  const adminBContext = await root.context().browser()!.newContext({ viewport: DESKTOP });
  const adminB = await adminBContext.newPage();
  watch(adminB, "admin B");
  await adminB.goto("/login");
  await adminB.locator('input[type="email"]').fill(ADMIN_B_EMAIL);
  await adminB.locator('input[name="password"]').fill(PASSWORD);
  await adminB.getByRole("button", { name: "Se connecter" }).click();
  await expect(adminB.getByText("Compte ou entreprise indisponible. Contactez votre administrateur.")).toBeVisible();
  await adminB.screenshot({ path: `${SHOTS}/adm1-09-entreprise-suspendue.png` });

  // Réactivation.
  await root.getByRole("button", { name: "Rétablir" }).click();
  await root.getByRole("dialog").getByRole("button", { name: "Rétablir" }).click();
  await expect(root.getByRole("button", { name: "Suspendre l'entreprise" })).toBeVisible();
  await adminBContext.clearCookies();
  await login(adminB, { email: ADMIN_B_EMAIL, password: PASSWORD }, "/login", "/dashboard");

  // Critère 10 dans le navigateur : aucun client, commande ni produit de A.
  await adminB.goto("/dashboard/merchants");
  await expect(adminB.getByText("Aucun client pour le moment.")).toBeVisible();
  await adminB.screenshot({ path: `${SHOTS}/adm1-10-admin-b-clients-vides.png` });
  const statuses = {
    merchantA: (await adminB.request.get(`/api/merchants/${merchantA}`)).status(),
    patchMerchantA: (await adminB.request.patch(`/api/merchants/${merchantA}`, { data: { active: false } })).status(),
    productsOfB: ((await (await adminB.request.get("/api/catalog/products")).json()) as { data: unknown[] }).data.length,
    merchantsOfB: ((await (await adminB.request.get("/api/merchants")).json()) as { data: unknown[] }).data.length,
  };
  report.criterion10 = statuses;
  expect(statuses).toEqual({ merchantA: 404, patchMerchantA: 404, productsOfB: 0, merchantsOfB: 0 });
  await adminB.goto("/dashboard/catalog");
  await expect(adminB.getByRole("heading", { name: "Catalogue" })).toBeVisible();
  await adminB.screenshot({ path: `${SHOTS}/adm1-11-admin-b-catalogue-vide.png` });
  await adminBContext.close();
  expect(consoleErrors).toEqual([]);
});
