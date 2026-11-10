import { mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { test, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";

/**
 * Recette navigateur du lot 1 (LOT1-RECETTE) : D1 à D9 sur annona-dev, serveur déjà lancé.
 * Lancement : E2E_BASE_URL=http://127.0.0.1:3110 E2E_SKIP_WEB_SERVER=1 PLAYWRIGHT_CHANNEL=chrome \
 *   npx playwright test tests/e2e/lot1-recette.spec.ts -g "D5"
 * Comptes lus dans outputs/comptes-demo.json (jamais affichés). Constats : outputs/recette-agents/lot1/.
 */

const OUT = resolve("outputs/recette-agents/lot1");
mkdirSync(OUT, { recursive: true });
const LOG = resolve(OUT, "constats.jsonl");

type Account = { email: string; password: string };
function account(key: string): Account {
  const all = JSON.parse(readFileSync(resolve("outputs/comptes-demo.json"), "utf8")) as Record<string, Account>;
  const found = all[key];
  if (!found) throw new Error(`compte ${key} absent`);
  return found;
}

export function note(id: string, data: unknown) {
  appendFileSync(LOG, JSON.stringify({ at: new Date().toISOString(), id, data }) + "\n");
}

const LOGIN_PATH: Record<string, string> = { admin: "/login", "mini-admin": "/login", boulanger: "/login" };
function loginPath(key: string) {
  if (key.startsWith("client")) return "/login/client";
  if (key.startsWith("livreur")) return "/login/driver";
  return LOGIN_PATH[key] ?? "/login";
}

export type Session = { context: BrowserContext; page: Page; errors: string[]; key: string };

export async function open(
  browser: Browser,
  key: string,
  options: { width?: number; dark?: boolean; geo?: { latitude: number; longitude: number } } = {}
): Promise<Session> {
  const width = options.width ?? 1280;
  const phone = width < 600;
  const context = await browser.newContext({
    viewport: phone ? { width, height: 844 } : { width, height: 900 },
    isMobile: phone,
    hasTouch: phone,
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    colorScheme: options.dark ? "dark" : "light",
    ...(options.geo ? { geolocation: options.geo, permissions: ["geolocation"] } : {}),
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror ${page.url()} : ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console ${page.url()} : ${message.text().slice(0, 300)}`);
  });
  const acc = account(key);
  await page.goto(loginPath(key));
  await page.locator('input[type="email"]').fill(acc.email);
  await page.locator('input[name="password"]').fill(acc.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 60_000 });
  return { context, page, errors, key };
}

/** Déconnexion : la route POST /api/auth/logout n'existe pas ; jeton Supabase révoqué puis cookies vidés. */
export async function close(session: Session) {
  const { context, page } = session;
  const status = await page.request.post("/api/auth/logout").then((r) => r.status()).catch(() => 0);
  const cookies = await context.cookies();
  const chunks = cookies.filter((c) => /^sb-.*-auth-token(\.\d+)?$/.test(c.name)).sort((a, b) => a.name.localeCompare(b.name));
  let revoked = 0;
  if (chunks.length > 0) {
    try {
      let raw = chunks.map((c) => decodeURIComponent(c.value)).join("");
      if (raw.startsWith("base64-")) raw = Buffer.from(raw.slice(7), "base64").toString("utf8");
      const token = (JSON.parse(raw) as { access_token?: string }).access_token;
      if (token && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        revoked = await page.request
          .post(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/logout?scope=local`, {
            headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
          })
          .then((r) => r.status());
      }
    } catch {
      revoked = -1;
    }
  }
  await context.clearCookies();
  note(`logout-${session.key}`, { apiLogout: status, supabaseLogout: revoked, errors: session.errors });
  await context.close();
}

export async function shot(page: Page, name: string, fullPage = false) {
  await page.screenshot({ path: resolve(OUT, `${name}.png`), fullPage });
}

export async function overflowPx(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

async function trackingJson(page: Page) {
  const res = await page.request.get("/api/tracking");
  const json = (await res.json()) as { data?: { drivers: Array<Record<string, unknown>> } };
  return json.data;
}

function summarize(data: Awaited<ReturnType<typeof trackingJson>>) {
  return (data?.drivers ?? []).map((d) => {
    const driver = d as {
      driverName: string;
      roundName: string;
      position: { latitude: number; longitude: number; updatedAt: string; stale: boolean } | null;
      nextStops: Array<{ merchantName: string }>;
      delivered: Array<{ merchantName: string }>;
      remainingCount: number;
      route: { from: string; approximate: boolean; waypoints: Array<{ latitude: number; longitude: number; label?: string }>; polyline: unknown[] | null };
    };
    return {
      driver: driver.driverName,
      round: driver.roundName,
      position: driver.position,
      next: driver.nextStops.map((s) => s.merchantName),
      delivered: driver.delivered.map((s) => s.merchantName),
      remaining: driver.remainingCount,
      routeFrom: driver.route.from,
      approximate: driver.route.approximate,
      waypoints: driver.route.waypoints.map((w) => `${w.label ?? "?"}@${w.latitude.toFixed(4)},${w.longitude.toFixed(4)}`),
      polylinePoints: driver.route.polyline?.length ?? 0,
    };
  });
}

const START = { latitude: 48.8301, longitude: 2.3556 };
const MOVED = { latitude: 48.8412, longitude: 2.3402 };

test.describe.configure({ mode: "serial" });
test.use({ actionTimeout: 25_000, navigationTimeout: 60_000 });

test("D5 suivi livreurs", async ({ browser }) => {
  test.setTimeout(420_000);
  const admin = await open(browser, "admin");
  const driver = await open(browser, "livreur-3", { width: 390, geo: START });
  try {
    // État avant démarrage (tournée assignée, non démarrée).
    await admin.page.goto("/dashboard/tracking");
    await admin.page.getByRole("heading", { name: "Suivi livreurs" }).waitFor();
    await admin.page.waitForTimeout(1500);
    note("D5-before", summarize(await trackingJson(admin.page)));
    await shot(admin.page, "D5-avant-demarrage");

    await driver.page.goto("/driver");
    await driver.page.getByTestId("driver-round-summary").first().waitFor({ timeout: 45_000 });
    const stopNames = await driver.page.getByTestId("driver-stop-name").allTextContents();
    note("D5-driver-stops", stopNames);
    await shot(driver.page, "D5-livreur-avant");
    await driver.page.getByTestId("driver-start").click();
    await driver.page.waitForTimeout(8000);
    await shot(driver.page, "D5-livreur-demarre");

    // 1) position reçue, trajet vers les prochains arrêts.
    await admin.page.reload();
    await admin.page.getByRole("heading", { name: "Suivi livreurs" }).waitFor();
    await admin.page.locator('[data-testid^="tracking-driver-"]').first().waitFor({ timeout: 30_000 });
    const first = summarize(await trackingJson(admin.page));
    note("D5-started", first);
    await admin.page.waitForTimeout(2000);
    await shot(admin.page, "D5-admin-position1");

    // Déplacement.
    await driver.context.setGeolocation(MOVED);
    await driver.page.waitForTimeout(6000);
    // L'onglet admin se rafraîchit seul (15 s) : attendre sans recharger.
    await admin.page.waitForTimeout(17_000);
    const moved = summarize(await trackingJson(admin.page));
    note("D5-moved", moved);
    await shot(admin.page, "D5-admin-position2");
    const markerBox = await admin.page.locator(".leaflet-marker-icon").last().boundingBox();
    note("D5-marker-box-after-move", markerBox);

    // Toucher le livreur sur la carte → fiche ouverte.
    const driverMarker = admin.page.locator(".leaflet-marker-pane .leaflet-marker-icon").filter({ hasText: /^[A-Z?]{1,2}$/ }).last();
    await driverMarker.click({ force: true });
    await admin.page.waitForTimeout(800);
    const detailsAfterMapClick = await admin.page.getByTestId("tracking-details").count();
    note("D5-map-click-opens-card", { detailsAfterMapClick });
    await shot(admin.page, "D5-admin-clic-carte");
    // Toucher la fiche (refermer puis rouvrir) → cadrage sur la carte.
    const cardButton = admin.page.locator('[data-testid^="tracking-driver-"] > button').first();
    await cardButton.click();
    await admin.page.waitForTimeout(500);
    const centerBefore = await admin.page.locator(".leaflet-map-pane").getAttribute("style");
    await admin.page.mouse.move(10, 10);
    await admin.page.locator(".leaflet-container").first().evaluate(() => undefined);
    await cardButton.click();
    await admin.page.waitForTimeout(1200);
    const centerAfter = await admin.page.locator(".leaflet-map-pane").getAttribute("style");
    note("D5-card-click-frames", { expanded: await cardButton.getAttribute("aria-expanded"), centerBefore, centerAfter });
    await shot(admin.page, "D5-admin-clic-fiche");

    // 3) Livré sur le premier arrêt.
    const current = driver.page.getByTestId("driver-delivered").first();
    await current.click();
    await driver.page.waitForTimeout(1500);
    await shot(driver.page, "D5-livreur-apres-livre1");
    const later = driver.page.getByRole("button", { name: "Plus tard" });
    if (await later.isVisible().catch(() => false)) await later.click();
    await driver.page.waitForTimeout(3000);
    await admin.page.waitForTimeout(17_000);
    const afterOne = summarize(await trackingJson(admin.page));
    note("D5-after-delivered-1", afterOne);
    await shot(admin.page, "D5-admin-apres-livre1");

    // Dark + 390 px sur l'onglet de suivi pendant qu'un livreur roule.
    const dark = await open(browser, "admin", { dark: true });
    await dark.page.goto("/dashboard/tracking");
    await dark.page.locator('[data-testid^="tracking-driver-"]').first().waitFor({ timeout: 30_000 });
    await dark.page.waitForTimeout(2000);
    await shot(dark.page, "D5-sombre-1280");
    await close(dark);
    const phone = await open(browser, "admin", { width: 390 });
    await phone.page.goto("/dashboard/tracking");
    await phone.page.locator('[data-testid^="tracking-driver-"]').first().waitFor({ timeout: 30_000 });
    await phone.page.waitForTimeout(2000);
    note("D5-390-overflow", await overflowPx(phone.page));
    await shot(phone.page, "D5-clair-390", true);
    await close(phone);

    // 4) Tous les arrêts livrés.
    for (let i = 0; i < 6; i += 1) {
      const button = driver.page.getByTestId("driver-delivered").first();
      if (!(await button.isVisible().catch(() => false))) {
        // ouvrir un arrêt non livré replié
        const pending = driver.page.locator('[data-testid="driver-stop"][data-status="PENDING"] > button').first();
        if (!(await pending.isVisible().catch(() => false))) break;
        await pending.click();
        await driver.page.waitForTimeout(500);
        if (!(await button.isVisible().catch(() => false))) break;
      }
      await button.click();
      await driver.page.waitForTimeout(1500);
      for (const name of ["Plus tard", "Fermer"]) {
        const b = driver.page.getByRole("button", { name, exact: true });
        if (await b.isVisible().catch(() => false)) await b.click();
      }
      await driver.page.waitForTimeout(1500);
    }
    await driver.page.waitForTimeout(3000);
    await shot(driver.page, "D5-livreur-termine", true);
    note("D5-driver-final-text", (await driver.page.getByTestId("driver-round").innerText()).slice(0, 600));
    await admin.page.waitForTimeout(17_000);
    const end = summarize(await trackingJson(admin.page));
    note("D5-after-complete", end);
    await shot(admin.page, "D5-admin-termine");
  } finally {
    note("D5-console", { admin: admin.errors, driver: driver.errors });
    await close(admin);
    await close(driver);
  }
});




const D8_NEW = "Code portail 1234, déposer à l'arrière";
const D8_ORIG = "Livraison par la cour, digicode 4821B.";

async function setAccess(page: Page, text: string) {
  await page.goto("/portal/settings");
  const box = page.getByRole("textbox", { name: "Consignes d'accès" });
  await box.waitFor();
  await box.fill(text);
  await page.getByRole("button", { name: "Enregistrer les consignes" }).click();
  await page.waitForTimeout(2000);
  await page.reload();
  await box.waitFor();
  await page.waitForTimeout(1000);
  return box.inputValue();
}

async function driverAccessText(page: Page) {
  await page.goto("/driver");
  await page.getByTestId("driver-round-summary").first().waitFor({ timeout: 45_000 });
  const stop = page.getByTestId("driver-stop").filter({ hasText: "Bistrot Valmy" }).first();
  const toggle = stop.locator("> button");
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  await page.waitForTimeout(800);
  return stop.innerText();
}

test("D8 consignes d'accès", async ({ browser }) => {
  test.setTimeout(240_000);
  const client = await open(browser, "client-2");
  const driver = await open(browser, "livreur-3", { width: 390 });
  try {
    const saved = await setAccess(client.page, D8_NEW);
    note("D8-client-saved-after-reload", saved);
    await shot(client.page, "D8-client-enregistre");
    const seen = await driverAccessText(driver.page);
    note("D8-driver-stop-text", seen);
    await driver.page.getByTestId("driver-stop").filter({ hasText: "Bistrot Valmy" }).first().screenshot({ path: resolve(OUT, "D8-livreur-arret.png") });
    const restored = await setAccess(client.page, D8_ORIG);
    note("D8-restored", restored);
    const seen2 = await driverAccessText(driver.page);
    note("D8-driver-after-restore", seen2.includes(D8_ORIG));
    // 501 caractères refusés côté client ?
    await client.page.getByRole("textbox", { name: "Consignes d'accès" }).fill("x".repeat(501));
    note("D8-501-value-length", (await client.page.getByRole("textbox", { name: "Consignes d'accès" }).inputValue()).length);
    await client.page.reload();
  } finally {
    note("D8-console", { client: client.errors, driver: driver.errors });
    await close(client);
    await close(driver);
  }
});

async function orderSlot(page: Page, dateLabel: string, slot: "Matin" | "Soir", product: string, qty: number, tag: string) {
  await page.goto("/portal");
  await page.getByRole("radiogroup", { name: "Date de livraison" }).getByRole("radio", { name: dateLabel }).click();
  await page.getByRole("radiogroup", { name: "Livraison", exact: true }).getByRole("radio", { name: slot }).click();
  await page.waitForTimeout(1500);
  const banner = await page.getByText("Vous avez déjà une commande pour ce jour").count();
  for (let i = 0; i < qty; i += 1) await page.getByRole("button", { name: `Ajouter un ${product}` }).click();
  await page.getByRole("button", { name: "Voir le panier" }).click();
  await page.waitForTimeout(1000);
  await shot(page, `D1-panier-${tag}`);
  await page.getByRole("button", { name: "Valider la commande" }).click();
  const t0 = Date.now();
  await page.getByText("Commande validée").first().waitFor({ timeout: 45_000 }).catch(() => undefined);
  const validateMs = Date.now() - t0;
  await page.waitForTimeout(1500);
  await shot(page, `D1-valide-${tag}`);
  const cartAfter = await page.getByRole("button", { name: "Voir le panier" }).count();
  return { existingBanner: banner, validateMs, cartBarStillVisible: cartAfter };
  return { existingBanner: banner, url: page.url() };
}

test("D1 tournées matin soir", async ({ browser }) => {
  test.setTimeout(400_000);
  const admin = await open(browser, "admin");
  try {
    // 1) création de « E2E Est ».
    await admin.page.goto("/settings");
    await admin.page.getByRole("heading", { name: "Tournées" }).waitFor();
    await admin.page.waitForTimeout(2000);
    if (process.env.D1_SKIP_CREATE !== "1") {
    await admin.page.getByRole("textbox", { name: "Nom de la tournée", exact: true }).fill("E2E Est");
    await admin.page.getByRole("textbox", { name: "Début du matin", exact: true }).fill("05:30");
    await admin.page.getByRole("textbox", { name: "Fin du matin", exact: true }).fill("11:00");
    await admin.page.getByRole("textbox", { name: "Début du soir", exact: true }).fill("16:00");
    await admin.page.getByRole("textbox", { name: "Fin du soir", exact: true }).fill("19:00");
    await admin.page.getByRole("button", { name: "Ajouter la tournée" }).click();
    await admin.page.waitForTimeout(2500);
    }
    const created = await admin.page.getByRole("textbox", { name: "Nom de la tournée — E2E Est" }).count();
    await admin.page.reload();
    await admin.page.getByRole("heading", { name: "Tournées" }).waitFor();
    await admin.page.waitForTimeout(1500);
    const afterReload = await admin.page.getByRole("textbox", { name: "Nom de la tournée — E2E Est" }).count();
    note("D1-zone-created", { created, afterReload });
    await admin.page.getByRole("heading", { name: "Tournées" }).scrollIntoViewIfNeeded();
    await shot(admin.page, "D1-tournees-creee");

    // Liste des clients : colonne Tournée ; fiche client : choix de la tournée (E2E Est proposée).
    await admin.page.goto("/dashboard/merchants");
    await admin.page.getByRole("columnheader", { name: "Tournée" }).waitFor({ timeout: 20_000 });
    const valmyRow = await admin.page.getByRole("row").filter({ hasText: "Bistrot Valmy" }).first().innerText();
    note("D1-merchants-row-valmy", valmyRow);
    await shot(admin.page, "D1-clients-colonne-tournee");
    await admin.page.getByRole("row").filter({ hasText: "Bistrot Valmy" }).first().getByRole("link").first().click();
    await admin.page.getByTestId("merchant-zone").waitFor({ timeout: 20_000 });
    await admin.page.waitForLoadState("networkidle").catch(() => undefined);
    await admin.page.waitForTimeout(4000);
    const zoneValue = await admin.page.getByTestId("merchant-zone").innerText();
    await admin.page.getByTestId("merchant-zone").click();
    const options = await admin.page.getByRole("option").allInnerTexts();
    note("D1-fiche-client-zone", { url: admin.page.url(), zoneValue, options });
    await shot(admin.page, "D1-fiche-client-choix-tournee");
    await admin.page.keyboard.press("Escape");

    // Carte Tournées en sombre 1280 et clair 390.
    const dark = await open(browser, "admin", { dark: true });
    await dark.page.goto("/settings");
    await dark.page.getByRole("heading", { name: "Tournées" }).scrollIntoViewIfNeeded();
    await dark.page.waitForTimeout(800);
    await shot(dark.page, "D1-tournees-sombre-1280");
    note("D1-dark-console", dark.errors);
    await close(dark);
    const phone = await open(browser, "admin", { width: 390 });
    await phone.page.goto("/settings");
    await phone.page.getByRole("heading", { name: "Tournées" }).scrollIntoViewIfNeeded();
    await phone.page.waitForTimeout(800);
    note("D1-390-overflow", await overflowPx(phone.page));
    await shot(phone.page, "D1-tournees-390");
    note("D1-phone-console", phone.errors);
    await close(phone);

    // Suppression de la tournée E2E (non utilisée).
    await admin.page.goto("/settings");
    await admin.page.getByRole("button", { name: "Supprimer E2E Est" }).click();
    await admin.page.waitForTimeout(2000);
    await admin.page.reload();
    await admin.page.getByRole("heading", { name: "Tournées" }).waitFor();
    await admin.page.waitForTimeout(1500);
    note("D1-zone-removed", { remaining: await admin.page.getByRole("textbox", { name: "Nom de la tournée — E2E Est" }).count() });
  } finally {
    note("D1-admin-console", admin.errors);
    await close(admin);
  }

  // 2-3) client-2 : Matin / Soir seulement ; deux commandes le même jour.
  const client = await open(browser, "client-2");
  try {
    await client.page.goto("/portal");
    const slots = await client.page.getByRole("radiogroup", { name: "Livraison", exact: true }).getByRole("radio").allInnerTexts();
    const slotNames = await client.page.getByRole("radiogroup", { name: "Livraison", exact: true }).getByRole("radio").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label") ?? e.textContent));
    note("D1-client-slots", { slots, slotNames });
    await shot(client.page, "D1-client-matin-soir");
    const morning = await orderSlot(client.page, "ven. 13 nov.", "Matin", "Ficelle", 2, "matin");
    const evening = await orderSlot(client.page, "ven. 13 nov.", "Soir", "Ficelle", 3, "soir");
    note("D1-orders", { morning, evening });
    await client.page.goto("/portal/orders");
    await client.page.waitForTimeout(3000);
    note("D1-portal-orders-text", (await client.page.locator("main").innerText()).slice(0, 1500));
    await shot(client.page, "D1-mes-commandes", true);
  } finally {
    note("D1-client-console", client.errors);
    await close(client);
  }

  // 5) boulanger : groupes « Sud matin » / « Sud soir ».
  const baker = await open(browser, "boulanger");
  try {
    await baker.page.goto("/bakery");
    await baker.page.waitForTimeout(4000);
    note("D1-bakery-text", (await baker.page.locator("main").innerText()).slice(0, 2000));
    await shot(baker.page, "D1-boulanger", true);
  } finally {
    note("D1-baker-console", baker.errors);
    await close(baker);
  }
});

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

test("D7 recherche récurrente", async ({ browser }) => {
  test.setTimeout(200_000);
  for (const width of [1280, 390]) {
    const client = await open(browser, "client-2", { width });
    try {
      await client.page.goto("/portal/recurring");
      await client.page.getByRole("button", { name: "Nouvelle commande récurrente" }).click();
      const dialog = client.page.getByRole("dialog");
      const search = dialog.getByRole("searchbox", { name: "Rechercher un article par son nom" });
      await search.waitFor();
      const items = dialog.getByRole("list", { name: "Ajouter un produit" }).locator("button");
      const names = async () => (await items.allInnerTexts()).map((s) => s.split("\n")[0]!.trim());
      const all = await names();
      await search.fill("bag");
      await client.page.waitForTimeout(600);
      const bag = await names();
      await shot(client.page, `D7-bag-${width}`);
      await search.fill("eclair");
      await client.page.waitForTimeout(600);
      const eclair = await names();
      await shot(client.page, `D7-eclair-${width}`);
      await search.fill("zzzz");
      await client.page.waitForTimeout(600);
      const none = { count: (await names()).length, text: (await dialog.innerText()).slice(-300) };
      await shot(client.page, `D7-aucun-${width}`);
      await search.fill("");
      await client.page.waitForTimeout(600);
      const cleared = await names();
      note(`D7-${width}`, {
        allCount: all.length,
        bag,
        bagAllMatch: bag.every((n) => norm(n).includes("bag")),
        bagMissing: all.filter((n) => norm(n).includes("bag") && !bag.includes(n)),
        eclair,
        none,
        clearedCount: cleared.length,
        overflow: await overflowPx(client.page),
      });
      await client.page.keyboard.press("Escape");
    } finally {
      note(`D7-console-${width}`, client.errors);
      await close(client);
    }
  }
});

test("D6 tableau de bord cliquable", async ({ browser }) => {
  test.setTimeout(300_000);
  const admin = await open(browser, "admin");
  try {
    await admin.page.goto("/dashboard");
    await admin.page.getByRole("heading", { name: "Tableau de bord" }).waitFor();
    await admin.page.waitForTimeout(2000);
    await shot(admin.page, "D6-tableau-de-bord");
    const kpis = await admin.page.locator("main a").evaluateAll((els) =>
      els.map((e) => ({ name: (e.getAttribute("aria-label") ?? e.textContent ?? "").trim().slice(0, 60), href: e.getAttribute("href") }))
    );
    note("D6-links", kpis);
    const statCards = await admin.page.locator("main").getByRole("link", { name: / : \d+$/ }).all();
    const labels = await Promise.all(statCards.map(async (l) => (await l.getAttribute("aria-label")) ?? (await l.innerText())));
    // Chiffres non cliquables restants (texte numérique hors lien) dans la zone des chiffres.
    for (const [index, label] of labels.entries()) {
      await admin.page.goto("/dashboard");
      await admin.page.getByRole("heading", { name: "Tableau de bord" }).waitFor();
      await admin.page.waitForTimeout(1500);
      const link = admin.page.locator("main").getByRole("link", { name: label.trim() }).first();
      await link.click();
      await admin.page.waitForLoadState("networkidle").catch(() => undefined);
      await admin.page.waitForTimeout(3000);
      const main = (await admin.page.locator("main").innerText()).replace(/\n+/g, " | ").slice(0, 600);
      const rows = await admin.page.locator("main tbody tr").count();
      note(`D6-click-${index}`, { label, url: admin.page.url().replace(/^https?:\/\/[^/]+/, ""), rows, main });
      await shot(admin.page, `D6-clic-${index}`);
    }
    // Lien « x / y livrés » d'une tournée et nombre de problèmes du tableau des tournées.
    await admin.page.goto("/dashboard");
    await admin.page.waitForTimeout(2500);
    const progress = admin.page.locator("main").getByRole("link", { name: /livrés/ }).first();
    if (await progress.count()) {
      await progress.click();
      await admin.page.waitForTimeout(3000);
      note("D6-round-progress", { url: admin.page.url().replace(/^https?:\/\/[^/]+/, ""), rows: await admin.page.locator("main tbody tr").count() });
      await shot(admin.page, "D6-clic-progression-tournee");
    }
    // Un chiffre sans lien ? éléments numériques non liens dans la grille des chiffres.
    await admin.page.goto("/dashboard");
    await admin.page.waitForTimeout(2500);
    const deadNumbers = await admin.page.locator("main").evaluate((main) => {
      const out: string[] = [];
      main.querySelectorAll("p, span, div").forEach((el) => {
        if (el.children.length === 0 && /^\d+$/.test((el.textContent ?? "").trim()) && !el.closest("a, button")) out.push(`${el.tagName}:${(el.parentElement?.textContent ?? "").trim().slice(0, 50)}`);
      });
      return out.slice(0, 20);
    });
    note("D6-numbers-without-link", deadNumbers);
    const dark = await open(browser, "admin", { dark: true });
    await dark.page.goto("/dashboard");
    await dark.page.waitForTimeout(3000);
    await shot(dark.page, "D6-sombre");
    note("D6-dark-console", dark.errors);
    await close(dark);
  } finally {
    note("D6-console", admin.errors);
    await close(admin);
  }
});

async function editProduct(page: Page, product: string, act: (dialog: ReturnType<Page["getByRole"]>) => Promise<void>) {
  await page.goto("/dashboard/catalog");
  await page.getByText(product, { exact: true }).first().click();
  const dialog = page.getByRole("dialog", { name: "Modifier le produit" });
  await dialog.waitFor();
  await act(dialog);
  const state = await dialog.getByTestId("allergens-state").innerText();
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await page.waitForTimeout(2500);
  return state;
}

async function clientAllergens(page: Page, product: string) {
  await page.goto("/portal");
  await page.getByRole("button", { name: `${product} : voir les allergènes`, exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  await page.waitForTimeout(500);
  const text = (await dialog.innerText()).replace(/\n+/g, " | ");
  return text;
}

test("D3 allergènes", async ({ browser }) => {
  test.setTimeout(300_000);
  const admin = await open(browser, "admin");
  const client = await open(browser, "client-2");
  try {
    const s1 = await editProduct(admin.page, "Baguette tradition", async (d) => {
      await d.getByRole("checkbox", { name: "Céréales contenant du gluten" }).check();
      await d.getByRole("checkbox", { name: "Lait" }).check();
      await d.screenshot({ path: resolve(OUT, "D3-admin-coche.png") });
    });
    const s2 = await editProduct(admin.page, "Bâtard", async (d) => {
      await d.getByRole("button", { name: "Aucun allergène" }).click();
    });
    note("D3-admin-states", { s1, s2 });
    const bt = await clientAllergens(client.page, "Baguette tradition");
    await shot(client.page, "D3-client-baguette");
    const batard = await clientAllergens(client.page, "Bâtard");
    await shot(client.page, "D3-client-aucun");
    const ficelle = await clientAllergens(client.page, "Ficelle");
    await shot(client.page, "D3-client-non-renseignes");
    note("D3-client", { bt, batard, ficelle });
    const phone = await open(browser, "client-2", { width: 390 });
    note("D3-client-390", await clientAllergens(phone.page, "Baguette tradition"));
    await shot(phone.page, "D3-client-390");
    note("D3-phone-console", phone.errors);
    await close(phone);
  } finally {
    // Remise : Baguette tradition et Bâtard « non renseignés ».
    const r1 = await editProduct(admin.page, "Baguette tradition", async (d) => {
      await d.getByRole("checkbox", { name: "Céréales contenant du gluten" }).uncheck();
      await d.getByRole("checkbox", { name: "Lait" }).uncheck();
      const reset = d.getByRole("button", { name: "Remettre à « non renseignés »" });
      if (await reset.count()) await reset.click();
    }).catch((e) => `ERR ${e}`);
    const r2 = await editProduct(admin.page, "Bâtard", async (d) => {
      const reset = d.getByRole("button", { name: "Remettre à « non renseignés »" });
      if (await reset.count()) await reset.click();
    }).catch((e) => `ERR ${e}`);
    note("D3-restore", { r1, r2, bt: await clientAllergens(client.page, "Baguette tradition").catch((e) => `ERR ${e}`) });
    note("D3-console", { admin: admin.errors, client: client.errors });
    await close(admin);
    await close(client);
  }
});

async function createPromotion(page: Page, opts: { product: string; percent?: string; price?: string; endsOn: string; limit?: string; merchants?: string[]; tag: string }) {
  await page.goto("/dashboard/promotions");
  await page.getByRole("button", { name: "Nouvelle promotion" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Nouvelle promotion" });
  await dialog.waitFor();
  await dialog.getByTestId("promotion-product").click();
  await page.getByRole("option", { name: new RegExp(`^${opts.product} ·`) }).click();
  if (opts.price) {
    await dialog.getByRole("radio", { name: "Prix promo" }).click();
    await dialog.getByTestId("promotion-price").fill(opts.price);
  } else {
    await dialog.getByTestId("promotion-percent").fill(opts.percent ?? "30");
  }
  await dialog.getByTestId("promotion-ends-on").fill(opts.endsOn);
  if (opts.limit) await dialog.getByTestId("promotion-quantity").fill(opts.limit);
  if (opts.merchants) {
    await dialog.getByRole("radio", { name: "Certains clients" }).click();
    for (const m of opts.merchants) await dialog.getByTestId("promotion-merchants").getByRole("checkbox", { name: m }).check();
  }
  await dialog.screenshot({ path: resolve(OUT, `D2-dialogue-${opts.tag}.png`) });
  await dialog.getByRole("button", { name: "Créer la promotion" }).click();
  await page.waitForTimeout(2500);
  const stillOpen = await dialog.isVisible().catch(() => false);
  const alert = stillOpen ? await dialog.getByRole("alert").innerText().catch(() => "") : "";
  return { stillOpen, alert };
}

async function portalPromoView(page: Page, products: string[]) {
  await page.goto("/portal");
  await page.getByRole("heading", { name: "Commander" }).waitFor();
  await page.waitForTimeout(2500);
  const firstRegion = await page.locator("main section[aria-label], main [role=region]").first().getAttribute("aria-label").catch(() => null);
  const regions = await page.getByRole("region").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label") ?? e.querySelector("h2")?.textContent ?? ""));
  const cards: Record<string, string> = {};
  for (const p of products) {
    const item = page.getByRole("listitem").filter({ has: page.getByRole("button", { name: `${p} : voir les allergènes`, exact: true }) }).first();
    cards[p] = (await item.innerText().catch(() => "absent")).replace(/\n+/g, " | ");
    const struck = await item.locator("s, del, .line-through").allInnerTexts().catch(() => []);
    cards[`${p}#barré`] = struck.join(",");
  }
  return { firstRegion, regions: regions.slice(0, 4), cards };
}

test("D2 promotions", async ({ browser }) => {
  test.setTimeout(480_000);
  const admin = await open(browser, "admin");
  try {
    const p1 = await createPromotion(admin.page, { product: "Ficelle", percent: "30", endsOn: "2026-11-15", merchants: ["Bistrot Valmy (démo)", "Épicerie Oberkampf & Co (démo)"], tag: "ficelle" });
    const p2 = await createPromotion(admin.page, { product: "Flûte", price: "0,80", endsOn: "2026-11-15", limit: "3", tag: "flute-limite" });
    note("D2-create", { p1, p2 });
    await admin.page.goto("/dashboard/promotions");
    await admin.page.waitForTimeout(2500);
    note("D2-admin-list", (await admin.page.locator("main").innerText()).replace(/\n+/g, " | ").slice(0, 900));
    await shot(admin.page, "D2-admin-liste");

    for (const key of ["client-1", "client-3"]) {
      const c = await open(browser, key);
      note(`D2-${key}`, await portalPromoView(c.page, ["Ficelle", "Flûte"]));
      await shot(c.page, `D2-${key}-catalogue`);
      note(`D2-${key}-console`, c.errors);
      await close(c);
    }

    const client = await open(browser, "client-2");
    try {
      note("D2-client-2", await portalPromoView(client.page, ["Ficelle", "Flûte"]));
      await shot(client.page, "D2-client-2-catalogue");
      await client.page.getByRole("radiogroup", { name: "Date de livraison" }).getByRole("radio", { name: "jeu. 12 nov." }).click();
      await client.page.getByRole("radiogroup", { name: "Livraison", exact: true }).getByRole("radio", { name: "Soir" }).click();
      await client.page.waitForTimeout(1500);
      note("D2-existing-banner", await client.page.getByText("Vous avez déjà une commande pour ce jour").count());
      for (let i = 0; i < 2; i += 1) await client.page.getByRole("button", { name: "Ajouter un Ficelle" }).first().click();
      for (let i = 0; i < 4; i += 1) await client.page.getByRole("button", { name: "Ajouter un Flûte" }).first().click();
      await client.page.waitForTimeout(800);
      note("D2-cart-bar", (await client.page.getByRole("button", { name: "Voir le panier" }).locator("xpath=..").innerText()).replace(/\n+/g, " | "));
      await client.page.getByRole("button", { name: "Voir le panier" }).click();
      await client.page.waitForTimeout(1200);
      const cart = client.page.getByRole("dialog");
      note("D2-cart", (await cart.innerText().catch(async () => client.page.locator("body").innerText())).replace(/\n+/g, " | ").slice(0, 1200));
      await shot(client.page, "D2-panier");
      await client.page.getByRole("button", { name: "Valider la commande" }).click();
      await client.page.getByText("Commande validée").first().waitFor({ timeout: 45_000 }).catch(() => undefined);
      await client.page.waitForTimeout(1500);
      note("D2-after-validate", { url: client.page.url(), text: (await client.page.locator("main").innerText()).replace(/\n+/g, " | ").slice(0, 600) });
      await shot(client.page, "D2-valide");
      await client.page.goto("/portal/orders");
      await client.page.waitForTimeout(3000);
      const link = client.page.locator('main a[href^="/portal/orders/"]').filter({ hasText: /12 nov|Jeudi 12/i }).first();
      if (await link.count()) {
        await link.click();
        await client.page.waitForTimeout(3000);
        note("D2-order-detail", { url: client.page.url(), text: (await client.page.locator("main").innerText()).replace(/\n+/g, " | ").slice(0, 1500) });
        await shot(client.page, "D2-detail-commande", true);
      } else {
        note("D2-order-detail", { missing: true, text: (await client.page.locator("main").innerText()).slice(0, 800) });
      }
      // Dark et 390 px du portail avec promotions.
    } finally {
      note("D2-client-2-console", client.errors);
      await close(client);
    }

    // Promotion épuisée : client-3 voit la Flûte au prix normal ; admin voit « Épuisée ».
    const c3 = await open(browser, "client-3");
    note("D2-client-3-after-soldout", await portalPromoView(c3.page, ["Ficelle", "Flûte"]));
    await shot(c3.page, "D2-client-3-epuisee");
    await close(c3);
    await admin.page.goto("/dashboard/promotions");
    await admin.page.waitForTimeout(2500);
    note("D2-admin-list-after", (await admin.page.locator("main").innerText()).replace(/\n+/g, " | ").slice(0, 900));
    await shot(admin.page, "D2-admin-liste-apres");

    const dark = await open(browser, "admin", { dark: true });
    await dark.page.goto("/dashboard/promotions");
    await dark.page.waitForTimeout(2500);
    await shot(dark.page, "D2-admin-sombre");
    await dark.page.getByRole("button", { name: "Nouvelle promotion" }).first().click();
    await dark.page.waitForTimeout(800);
    await shot(dark.page, "D2-dialogue-sombre");
    note("D2-dark-console", dark.errors);
    await close(dark);
    const phone = await open(browser, "admin", { width: 390 });
    await phone.page.goto("/dashboard/promotions");
    await phone.page.waitForTimeout(2500);
    const o1 = await overflowPx(phone.page);
    await shot(phone.page, "D2-admin-390", true);
    await phone.page.getByRole("button", { name: "Nouvelle promotion" }).first().click();
    await phone.page.waitForTimeout(800);
    await phone.page.getByRole("dialog").getByRole("radio", { name: "Certains clients" }).click();
    const o2 = await overflowPx(phone.page);
    const dialogBox = await phone.page.getByRole("dialog").boundingBox();
    await shot(phone.page, "D2-dialogue-390");
    note("D2-390", { listOverflow: o1, dialogOverflow: o2, dialogBox, errors: phone.errors });
    await close(phone);
    const c2p = await open(browser, "client-2", { width: 390 });
    note("D2-client-2-390", { ...(await portalPromoView(c2p.page, ["Ficelle"])), overflow: await overflowPx(c2p.page) });
    await shot(c2p.page, "D2-client-2-390");
    await close(c2p);
    const c2d = await open(browser, "client-2", { dark: true });
    await c2d.page.goto("/portal");
    await c2d.page.waitForTimeout(3000);
    await shot(c2d.page, "D2-client-2-sombre");
    note("D2-client-dark-console", c2d.errors);
    await close(c2d);
  } finally {
    // Arrêt des promotions créées (deux clics chacune).
    await admin.page.goto("/dashboard/promotions");
    await admin.page.waitForTimeout(2500);
    for (let i = 0; i < 4; i += 1) {
      const stop = admin.page.getByTestId("promotion-stop").first();
      if (!(await stop.isVisible().catch(() => false))) break;
      await stop.click();
      await admin.page.getByTestId("promotion-stop-confirm").first().click();
      await admin.page.waitForTimeout(2500);
    }
    note("D2-after-stop", (await admin.page.locator("main").innerText()).replace(/\n+/g, " | ").slice(0, 900));
    await shot(admin.page, "D2-admin-arretees");
    note("D2-admin-console", admin.errors);
    await close(admin);
  }
});

async function navLinks(page: Page) {
  return page.getByRole("navigation", { name: "Navigation principale" }).getByRole("link").allInnerTexts().catch(() => [] as string[]);
}

async function setModules(admin: Page, mode: "all" | "orders+tracking" | "remove-orders") {
  await admin.goto("/users");
  await admin.getByRole("button", { name: "Modifier Maël Mini" }).click();
  const dialog = admin.getByRole("dialog");
  await dialog.waitFor();
  await admin.waitForTimeout(800);
  if (mode === "all") {
    const all = dialog.getByRole("button", { name: "Tout cocher" });
    if (await all.count()) await all.click();
  } else if (mode === "remove-orders") {
    await dialog.getByRole("checkbox", { name: "Commandes", exact: true }).uncheck();
  } else {
    const none = dialog.getByRole("button", { name: "Tout décocher" });
    if (await none.count()) await none.click();
    else {
      const all = dialog.getByRole("button", { name: "Tout cocher" });
      if (await all.count()) { await all.click(); await dialog.getByRole("button", { name: "Tout décocher" }).click(); }
    }
    await dialog.getByRole("checkbox", { name: "Commandes", exact: true }).check();
    await dialog.getByRole("checkbox", { name: "Suivi des livreurs", exact: true }).check();
  }
  const checked = await dialog.getByRole("checkbox", { checked: true }).evaluateAll((els) => els.map((e) => e.getAttribute("aria-label") ?? e.closest("label")?.textContent?.trim() ?? e.id));
  await dialog.screenshot({ path: resolve(OUT, `D4-modules-${mode}.png`) });
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await admin.waitForTimeout(2500);
  return { checked, stillOpen: await dialog.isVisible().catch(() => false) };
}

test("D4 mini admin", async ({ browser }) => {
  test.setTimeout(480_000);
  const admin = await open(browser, "admin");
  const email = `e2e-mini-${Date.now()}@annona.fr`;
  try {
    // 1) Création d'un mini admin.
    await admin.page.goto("/users");
    await admin.page.getByRole("button", { name: "Inviter un utilisateur" }).click();
    const dialog = admin.page.getByRole("dialog", { name: "Inviter un utilisateur" });
    await dialog.getByRole("textbox", { name: "Prénom (obligatoire)" }).fill("E2E");
    await dialog.getByRole("textbox", { name: "Nom (obligatoire)", exact: true }).fill("Minirecette");
    await dialog.getByRole("textbox", { name: "Adresse e-mail (obligatoire)" }).fill(email);
    await dialog.getByRole("combobox", { name: "Rôle" }).click();
    const roleOptions = await admin.page.getByRole("option").allInnerTexts();
    await admin.page.getByRole("option", { name: "Mini admin" }).click();
    await admin.page.waitForTimeout(500);
    await dialog.getByRole("checkbox", { name: "Commandes", exact: true }).check();
    await dialog.getByRole("checkbox", { name: "Suivi des livreurs", exact: true }).check();
    await dialog.screenshot({ path: resolve(OUT, "D4-creation-dialogue.png") });
    await dialog.getByRole("button", { name: "Envoyer l’invitation" }).click();
    await admin.page.waitForTimeout(4000);
    const toasts = await admin.page.locator("[data-sonner-toast]").allInnerTexts();
    const stillOpen = await dialog.isVisible().catch(() => false);
    const dialogError = stillOpen ? (await dialog.innerText()).slice(-300) : "";
    await shot(admin.page, "D4-creation-resultat");
    if (stillOpen) await admin.page.keyboard.press("Escape");
    await admin.page.goto("/users");
    await admin.page.getByRole("textbox", { name: "Rechercher un compte..." }).fill("e2e-mini");
    await admin.page.waitForTimeout(1500);
    const createdRow = await admin.page.getByRole("row").filter({ hasText: email }).allInnerTexts();
    note("D4-create", { roleOptions, toasts, stillOpen, dialogError, createdRow });

    // Dialogue en sombre et 390 px.
    const dark = await open(browser, "admin", { dark: true });
    await dark.page.goto("/users");
    await dark.page.getByRole("button", { name: "Inviter un utilisateur" }).click();
    await dark.page.getByRole("dialog").getByRole("combobox", { name: "Rôle" }).click();
    await dark.page.getByRole("option", { name: "Mini admin" }).click();
    await dark.page.waitForTimeout(600);
    await shot(dark.page, "D4-dialogue-sombre");
    await close(dark);
    const phone = await open(browser, "admin", { width: 390 });
    await phone.page.goto("/users");
    await phone.page.getByRole("button", { name: "Inviter un utilisateur" }).click();
    await phone.page.getByRole("dialog").getByRole("combobox", { name: "Rôle" }).click();
    await phone.page.getByRole("option", { name: "Mini admin" }).click();
    await phone.page.waitForTimeout(600);
    note("D4-dialog-390", { overflow: await overflowPx(phone.page), box: await phone.page.getByRole("dialog").boundingBox(), errors: phone.errors });
    await shot(phone.page, "D4-dialogue-390");
    await close(phone);

    // 2-3) Mini admin de démo.
    const mini = await open(browser, "mini-admin");
    try {
      await mini.page.waitForTimeout(2500);
      note("D4-mini-landing", { url: mini.page.url(), nav: await navLinks(mini.page) });
      await shot(mini.page, "D4-mini-menu");
      const forbidden: Record<string, string> = {};
      for (const path of ["/dashboard/catalog", "/settings", "/dashboard/promotions", "/users", "/dashboard"]) {
        await mini.page.goto(path);
        await mini.page.waitForTimeout(3500);
        forbidden[path] = mini.page.url().replace(/^https?:\/\/[^/]+/, "") + " | " + (await mini.page.locator("main h1").first().innerText().catch(() => "?"));
      }
      await shot(mini.page, "D4-mini-adresse-interdite");
      const api: Record<string, number> = {};
      for (const path of ["/api/catalog/promotions", "/api/catalog/products", "/api/company/zones", "/api/company/settings", "/api/users", "/api/tracking", "/api/orders"]) {
        api[path] = await mini.page.request.get(path).then((r) => r.status());
      }
      note("D4-mini-forbidden", { forbidden, api });

      // 4) Toutes les fonctionnalités.
      await mini.page.goto("/dashboard/orders");
      await mini.page.waitForTimeout(2000);
      note("D4-set-all", await setModules(admin.page, "all"));
      const t0 = Date.now();
      let navAll: string[] = await navLinks(mini.page);
      while (navAll.length <= 2 && Date.now() - t0 < 35_000) {
        await mini.page.waitForTimeout(5000);
        navAll = await navLinks(mini.page);
      }
      const noNavSeconds = Math.round((Date.now() - t0) / 1000);
      await mini.page.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name: "Suivi livreurs" }).click().catch(() => undefined);
      await mini.page.waitForTimeout(2500);
      const navAfterClick = await navLinks(mini.page);
      await mini.page.goto("/dashboard/catalog");
      await mini.page.waitForTimeout(3000);
      note("D4-all", { navWithoutNavigation: navAll, secondsWaited: noNavSeconds, navAfterClick, catalogUrl: mini.page.url().replace(/^https?:\/\/[^/]+/, "") });
      await shot(mini.page, "D4-mini-tout");

      // 5) Retrait de « Commandes » pendant que le mini admin est sur la page des commandes.
      await mini.page.goto("/dashboard/orders");
      await mini.page.waitForTimeout(2000);
      note("D4-remove-orders", await setModules(admin.page, "remove-orders"));
      const t1 = Date.now();
      const timeline: string[] = [];
      while (Date.now() - t1 < 40_000) {
        await mini.page.waitForTimeout(5000);
        timeline.push(`${Math.round((Date.now() - t1) / 1000)}s ${mini.page.url().replace(/^https?:\/\/[^/]+/, "")} nav=${(await navLinks(mini.page)).includes("Commandes")}`);
        if (!mini.page.url().includes("/dashboard/orders")) break;
      }
      await shot(mini.page, "D4-mini-commandes-retirees");
      await mini.page.goto("/dashboard/orders");
      await mini.page.waitForTimeout(3000);
      note("D4-removed", { timeline, afterGoto: mini.page.url().replace(/^https?:\/\/[^/]+/, ""), ordersApi: await mini.page.request.get("/api/orders").then((r) => r.status()) });
    } finally {
      note("D4-mini-console", mini.errors);
      await close(mini);
    }
  } finally {
    note("D4-restore", await setModules(admin.page, "orders+tracking").catch((e) => `ERR ${e}`));
    // Suppression du compte e2e créé.
    await admin.page.goto("/users");
    await admin.page.getByRole("textbox", { name: "Rechercher un compte..." }).fill("e2e-mini");
    await admin.page.waitForTimeout(1500);
    const rows = admin.page.getByRole("row").filter({ hasText: "e2e-mini" });
    const n = await rows.count();
    for (let i = 0; i < n; i += 1) {
      await rows.first().getByRole("button", { name: /^Supprimer/ }).click();
      await admin.page.waitForTimeout(800);
      const confirm = admin.page.getByRole("alertdialog").or(admin.page.getByRole("dialog")).getByRole("button", { name: /Supprimer|Confirmer/ }).last();
      await confirm.click();
      await admin.page.waitForTimeout(2500);
    }
    await admin.page.reload();
    await admin.page.getByRole("textbox", { name: "Rechercher un compte..." }).fill("e2e-mini");
    await admin.page.waitForTimeout(1500);
    note("D4-cleanup", { deleted: n, remaining: await admin.page.getByRole("row").filter({ hasText: "e2e-mini" }).count() });
    note("D4-admin-console", admin.errors);
    await close(admin);
  }
});

test("D9 téléphone et non-régression", async ({ browser }) => {
  test.setTimeout(300_000);
  const result: Record<string, unknown> = {};
  const client = await open(browser, "client-1", { width: 390 });
  for (const path of ["/portal/orders", "/portal"]) {
    const urls: string[] = [];
    const handler = (frame: import("@playwright/test").Frame) => { if (frame === client.page.mainFrame()) urls.push(frame.url().replace(/^https?:\/\/[^/]+/, "")); };
    client.page.on("framenavigated", handler);
    await client.page.goto(path);
    const blankAt: number[] = [];
    for (const ms of [300, 800, 1500, 3000]) {
      await client.page.waitForTimeout(ms === 300 ? 300 : ms - [300, 800, 1500, 3000][[300, 800, 1500, 3000].indexOf(ms) - 1]!);
      const len = (await client.page.locator("body").innerText().catch(() => "")).trim().length;
      blankAt.push(len);
    }
    client.page.off("framenavigated", handler);
    result[`client ${path}`] = { urls, textLengthAt300_800_1500_3000ms: blankAt, overflow: await overflowPx(client.page) };
    await shot(client.page, `D9-client-${path.replace(/\//g, "_")}`);
  }
  result["client errors"] = client.errors;
  await close(client);
  const driver = await open(browser, "livreur-1", { width: 390 });
  for (const path of ["/driver", "/driver/missions"]) {
    const urls: string[] = [];
    const handler = (frame: import("@playwright/test").Frame) => { if (frame === driver.page.mainFrame()) urls.push(frame.url().replace(/^https?:\/\/[^/]+/, "")); };
    driver.page.on("framenavigated", handler);
    await driver.page.goto(path);
    const lens: number[] = [];
    for (const wait of [300, 500, 700, 1500]) { await driver.page.waitForTimeout(wait); lens.push((await driver.page.locator("body").innerText().catch(() => "")).trim().length); }
    driver.page.off("framenavigated", handler);
    result[`driver ${path}`] = { urls, textLengths: lens, overflow: await overflowPx(driver.page) };
    await shot(driver.page, `D9-livreur-${path.replace(/\//g, "_")}`);
  }
  result["driver errors"] = driver.errors;
  await close(driver);
  const admin = await open(browser, "admin");
  await admin.page.goto("/dashboard");
  await admin.page.waitForTimeout(4000);
  result["admin /dashboard errors"] = admin.errors;
  await close(admin);
  note("D9", result);
});


test("D1c sans tournée, matin et soir chez le boulanger", async ({ browser }) => {
  test.setTimeout(400_000);
  const client = await open(browser, "client-3");
  try {
    await client.page.goto("/portal");
    await client.page.getByRole("radiogroup", { name: "Livraison", exact: true }).waitFor();
    note("D1c-slots", await client.page.getByRole("radiogroup", { name: "Livraison", exact: true }).innerText());
    const skip = process.env.D1C_SKIP_ORDERS === "1";
    const m = skip ? null : await orderSlot(client.page, "jeu. 12 nov.", "Matin", "Ficelle", 1, "c3-matin");
    const e = skip ? null : await orderSlot(client.page, "jeu. 12 nov.", "Soir", "Ficelle", 2, "c3-soir");
    await client.page.goto("/portal/orders");
    await client.page.waitForTimeout(3000);
    note("D1c-orders", { m, e, list: (await client.page.locator("main").innerText()).replace(/\n+/g, " | ").slice(0, 900) });
  } finally {
    note("D1c-client-console", client.errors);
  }
  const baker = await open(browser, "boulanger");
  try {
    await baker.page.goto("/bakery");
    await baker.page.getByRole("button", { name: /^Après-demain/ }).click();
    await baker.page.waitForTimeout(3500);
    note("D1c-bakery-12", (await baker.page.locator("main").innerText()).replace(/\n+/g, " | ").slice(0, 700));
    await shot(baker.page, "D1-boulanger-12nov");
    await baker.page.getByRole("button", { name: /^Aujourd'hui/ }).click();
    await baker.page.waitForTimeout(3500);
    await baker.page.getByRole("tab", { name: "Par tournée" }).click();
    await baker.page.waitForTimeout(2500);
    note("D1c-bakery-10-par-tournee", (await baker.page.locator("main").innerText()).replace(/\n+/g, " | ").slice(0, 1200));
    await shot(baker.page, "D1-boulanger-par-tournee", true);
  } finally {
    note("D1c-baker-console", baker.errors);
    await close(baker);
  }
  // Client sans tournée : Épicerie Oberkampf passée à « Aucune tournée », puis remise sur Sud.
  const admin = await open(browser, "admin");
  const setZone = async (zone: string) => {
    await admin.page.goto("/dashboard/merchants");
    await admin.page.getByRole("row").filter({ hasText: "Épicerie Oberkampf" }).first().getByRole("link").first().click();
    await admin.page.getByTestId("merchant-zone").waitFor({ timeout: 20_000 });
    await admin.page.waitForLoadState("networkidle").catch(() => undefined);
    await admin.page.waitForTimeout(3000);
    await admin.page.getByTestId("merchant-zone").click();
    await admin.page.getByRole("option", { name: zone, exact: true }).click();
    await admin.page.getByRole("button", { name: /^Enregistrer/ }).last().click();
    await admin.page.waitForTimeout(3000);
    await admin.page.reload();
    await admin.page.getByTestId("merchant-zone").waitFor({ timeout: 20_000 });
    await admin.page.waitForLoadState("networkidle").catch(() => undefined);
    await admin.page.waitForTimeout(3000);
    return admin.page.getByTestId("merchant-zone").innerText();
  };
  try {
    note("D1c-zone-none", await setZone("Aucune tournée"));
    await client.page.goto("/portal");
    await client.page.waitForTimeout(4000);
    note("D1c-client-sans-tournee", (await client.page.locator("main").innerText()).replace(/\n+/g, " | ").slice(0, 600));
    await shot(client.page, "D1-client-sans-tournee");
  } finally {
    note("D1c-zone-restored", await setZone("Sud").catch((err) => `ERR ${err}`));
    note("D1c-admin-console", admin.errors);
    await close(admin);
    await close(client);
  }
});

test("D6b commandes du jour et progression", async ({ browser }) => {
  test.setTimeout(200_000);
  const admin = await open(browser, "admin");
  try {
    await admin.page.goto("/dashboard");
    await admin.page.getByRole("link", { name: /^Commandes du jour/ }).click();
    await admin.page.getByRole("heading", { name: "Commandes", level: 1 }).waitFor({ timeout: 60_000 });
    await admin.page.waitForTimeout(4000);
    note("D6b-orders-day", { url: admin.page.url().replace(/^https?:\/\/[^/]+/, ""), rows: await admin.page.locator("main tbody tr").count(), text: (await admin.page.locator("main").innerText()).replace(/\n+/g, " | ").slice(0, 500) });
    await shot(admin.page, "D6-clic-commandes-du-jour");
    await admin.page.goto("/dashboard");
    await admin.page.getByRole("link", { name: /^\d+ \/ \d+ livrés$/ }).first().click();
    await admin.page.getByRole("heading", { name: "Commandes", level: 1 }).waitFor({ timeout: 60_000 });
    await admin.page.waitForTimeout(4000);
    note("D6b-round-progress", { url: admin.page.url().replace(/^https?:\/\/[^/]+/, ""), rows: await admin.page.locator("main tbody tr").count(), text: (await admin.page.locator("main").innerText()).replace(/\n+/g, " | ").slice(0, 400) });
    await shot(admin.page, "D6-clic-progression-tournee");
  } finally {
    note("D6b-console", admin.errors);
    await close(admin);
  }
});


test("CLEAN e2e accounts", async ({ browser }) => {
  test.setTimeout(200_000);
  const admin = await open(browser, "admin");
  try {
    await admin.page.goto("/users");
    await admin.page.getByRole("heading", { name: "Gestion des comptes" }).waitFor();
    await admin.page.waitForTimeout(3000);
    const filters = await admin.page.locator("main").getByRole("button", { name: /\(\d+\)$/ }).allInnerTexts();
    const rowsAll = await admin.page.getByRole("row").allInnerTexts();
    const e2eRows = rowsAll.filter((r) => /e2e|Minirecette/i.test(r));
    note("CLEAN-users", { filters, e2eRows, total: rowsAll.length });
    await shot(admin.page, "CLEAN-comptes-avant", true);
    if (process.env.CLEAN_DELETE === "1") {
      for (let i = 0; i < 5; i += 1) {
        const row = admin.page.getByRole("row").filter({ hasText: /e2e-mini-.*@annona\.fr/ }).first();
        if (!(await row.count())) break;
        await row.getByRole("button", { name: /^Supprimer/ }).click();
        await admin.page.waitForTimeout(800);
        const box = admin.page.getByRole("alertdialog").or(admin.page.getByRole("dialog")).last();
        note(`CLEAN-confirm-${i}`, (await box.innerText().catch(() => "")).replace(/\n+/g, " | ").slice(0, 300));
        await box.getByRole("button", { name: /^Supprimer|^Confirmer/ }).last().click();
        await admin.page.waitForTimeout(3000);
      }
      await admin.page.reload();
      await admin.page.getByRole("heading", { name: "Gestion des comptes" }).waitFor();
      await admin.page.waitForTimeout(3000);
      const after = (await admin.page.getByRole("row").allInnerTexts()).filter((r) => /e2e|Minirecette/i.test(r));
      note("CLEAN-after", { after, filters: await admin.page.locator("main").getByRole("button", { name: /\(\d+\)$/ }).allInnerTexts() });
    }
    // Promotions à 390 px : bouton Arrêter atteignable ?
    const phone = await open(browser, "admin", { width: 390 });
    await phone.page.goto("/dashboard/promotions");
    await phone.page.waitForTimeout(3000);
    const tables = await phone.page.locator("main table").evaluateAll((els) => els.map((t) => {
      const wrap = t.parentElement!;
      return { scrollW: wrap.scrollWidth, clientW: wrap.clientWidth, overflowX: getComputedStyle(wrap).overflowX };
    }));
    note("CLEAN-promos-390-tables", tables);
    await close(phone);
  } finally {
    note("CLEAN-console", admin.errors);
    await close(admin);
  }
});
