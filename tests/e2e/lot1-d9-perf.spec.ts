import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { test, type Browser, type CDPSession, type Page } from "@playwright/test";

/**
 * Lot 1, demande 9 — temps d'affichage de chaque écran sur téléphone, et débordements.
 *
 * Profil « téléphone 4G » : écran 360 × 740 tactile, réseau 4G (aller-retour 150 ms, 9 Mbit/s en
 * réception, 1,5 Mbit/s en émission) et processeur ralenti 4 fois (téléphone milieu de gamme).
 * Temps d'un écran = du début de la navigation jusqu'à « prêt » : titre de la nouvelle page visible, plus
 * aucun squelette de chargement. Deux mesures par écran :
 * - « première ouverture » : chargement complet de l'adresse, cache vide (session relue, tout le code reçu) ;
 * - « navigation » : passage depuis un autre écran dans l'application (routeur Next, cache chaud), le cas
 *   courant une fois l'application ouverte.
 * Chaque écran est aussi contrôlé : défilement horizontal et cibles tactiles de moins de 44 px.
 *
 * Lancement (serveur de production déjà démarré) :
 *   E2E_BASE_URL=http://localhost:3270 E2E_SKIP_WEB_SERVER=1 E2E_PERF_OUT=outputs/perf/avant.json \
 *     npx playwright test tests/e2e/lot1-d9-perf.spec.ts
 * `E2E_PERF_SCREENS=lot1` ajoute les écrans du lot 1 (promotions, suivi livreurs) : base migrée seulement.
 */

type Account = { email: string; password: string };
type Measure = {
  space: string;
  screen: string;
  path: string;
  coldMs: number | null;
  navMs: number | null;
  overflowPx: number;
  smallTargets: string[];
  error?: string;
};

const OUT = process.env.E2E_PERF_OUT ?? "outputs/perf/mesures.json";
const WITH_LOT1 = process.env.E2E_PERF_SCREENS === "lot1";
const READY_TIMEOUT_MS = 30_000;
const VIEWPORT = { width: 360, height: 740 };
const NETWORK = { offline: false, latency: 150, downloadThroughput: (9_000_000 / 8), uploadThroughput: (1_500_000 / 8) };

function accounts(): Record<string, Account> | null {
  try {
    return JSON.parse(readFileSync(resolve("outputs/comptes-demo.json"), "utf8")) as Record<string, Account>;
  } catch {
    return null;
  }
}

type Screen = { screen: string; path: string; firstLink?: RegExp };
const SPACES: Array<{ space: string; account: string; login: string; home: string; screens: Screen[] }> = [
  {
    space: "Administrateur",
    account: "admin",
    login: "/login",
    home: "/dashboard",
    screens: [
      { screen: "Tableau de bord", path: "/dashboard" },
      { screen: "Commandes", path: "/dashboard/orders", firstLink: /^\/dashboard\/orders\/[^/?]+$/ },
      { screen: "Tournées", path: "/dashboard/rounds" },
      { screen: "Clients", path: "/dashboard/merchants", firstLink: /^\/dashboard\/merchants\/(?!new)[^/?]+$/ },
      { screen: "Catalogue", path: "/dashboard/catalog" },
      ...(WITH_LOT1 ? [{ screen: "Promotions", path: "/dashboard/promotions" }, { screen: "Suivi livreurs", path: "/dashboard/tracking" }] : []),
      { screen: "Factures", path: "/dashboard/invoices", firstLink: /^\/dashboard\/invoices\/[^/?]+$/ },
      { screen: "Support", path: "/support" },
      { screen: "Gestion des comptes", path: "/users" },
      { screen: "Facturation", path: "/settings/billing" },
      { screen: "Paramètres", path: "/settings" },
    ],
  },
  { space: "Boulanger", account: "boulanger", login: "/login", home: "/bakery", screens: [{ screen: "Production", path: "/bakery" }] },
  {
    space: "Client",
    account: "client-1",
    login: "/login/client",
    home: "/portal",
    screens: [
      { screen: "Commander", path: "/portal" },
      { screen: "Mes commandes", path: "/portal/orders", firstLink: /^\/portal\/orders\/[^/?]+$/ },
      { screen: "Historique", path: "/portal/orders?tab=history" },
      { screen: "Commande récurrente", path: "/portal/recurring" },
      { screen: "Factures", path: "/portal/invoices" },
      { screen: "Support", path: "/portal/support" },
      { screen: "Paramètres", path: "/portal/settings" },
      { screen: "Profil", path: "/portal/profile" },
    ],
  },
  {
    space: "Livreur",
    account: "livreur-1",
    login: "/login/driver",
    home: "/driver",
    screens: [
      { screen: "Ma tournée", path: "/driver" },
      { screen: "Profil", path: "/driver/profile" },
    ],
  },
];

async function throttle(page: Page): Promise<CDPSession> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", NETWORK);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  return cdp;
}

/** Prêt : bonne adresse, document chargé, un titre neuf visible, plus de squelette ni de « Chargement… ». */
async function waitReady(page: Page, path: string) {
  await page.waitForFunction(
    (target) => {
      if (document.readyState !== "complete") return false;
      if (location.pathname !== target.split("?")[0]) return false;
      const visible = (el: Element) => {
        const rect = (el as HTMLElement).getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && getComputedStyle(el).visibility !== "hidden";
      };
      const heading = [...document.querySelectorAll("main h1, h1")].some((el) => visible(el) && !el.hasAttribute("data-perf-old"));
      const loading = [...document.querySelectorAll(".animate-pulse, [data-slot='skeleton'], [aria-busy='true']")].some(visible);
      const text = document.body.innerText.includes("Chargement…");
      return heading && !loading && !text;
    },
    path,
    { timeout: READY_TIMEOUT_MS, polling: 50 }
  );
}

/** Première ouverture : chargement complet de l'adresse. */
async function timeLoad(page: Page, path: string) {
  const started = Date.now();
  await page.goto(path, { waitUntil: "commit", timeout: READY_TIMEOUT_MS });
  await waitReady(page, path);
  return Date.now() - started;
}

/** Navigation dans l'application : routeur Next (comme un lien du menu), depuis l'écran courant. */
async function timeNavigation(page: Page, path: string) {
  await page.evaluate(() => document.querySelectorAll("h1").forEach((el) => el.setAttribute("data-perf-old", "")));
  const started = Date.now();
  const pushed = await page.evaluate((target) => {
    const router = (window as unknown as { next?: { router?: { push: (href: string) => void } } }).next?.router;
    if (!router) return false;
    router.push(target);
    return true;
  }, path);
  if (!pushed) await page.goto(path, { waitUntil: "commit" });
  await waitReady(page, path);
  return Date.now() - started;
}

async function layoutChecks(page: Page) {
  return page.evaluate(() => {
    const overflowPx = Math.max(0, document.documentElement.scrollWidth - window.innerWidth);
    const small: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>("a[href], button, [role='button'], input:not([type='hidden']), select")) {
      if (el.closest("[hidden], [aria-hidden='true'], .sr-only, .leaflet-container")) continue;
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none") continue;
      let rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0 || rect.right <= 0 || rect.top < -200) continue;
      // Zone tactile agrandie par un pseudo-élément (interrupteurs) ou par l'étiquette qui contient le champ.
      for (const pseudo of ["::before", "::after"] as const) {
        const hit = getComputedStyle(el, pseudo);
        if (hit.content !== "none" && hit.position === "absolute") {
          const grow = (value: string) => -(parseFloat(value) || 0);
          rect = new DOMRect(rect.x, rect.y, rect.width + grow(hit.left) + grow(hit.right), rect.height + grow(hit.top) + grow(hit.bottom));
        }
      }
      const label = el.closest("label");
      if (label) {
        const box = label.getBoundingClientRect();
        if (box.height >= 44) continue;
      }
      // Lien au milieu d'une phrase : exception « en ligne » de WCAG 2.5.8.
      if (el.tagName === "A" && style.display === "inline" && el.parentElement && el.parentElement.innerText.trim().length > (el.innerText ?? "").trim().length + 20) continue;
      if (rect.height < 44 && rect.width < 44) small.push(`${el.tagName.toLowerCase()} « ${(el.getAttribute("aria-label") ?? el.innerText ?? "").trim().slice(0, 40)} » ${Math.round(rect.width)}×${Math.round(rect.height)}`);
      else if (rect.height < 32) small.push(`${el.tagName.toLowerCase()} « ${(el.getAttribute("aria-label") ?? el.innerText ?? "").trim().slice(0, 40)} » ${Math.round(rect.width)}×${Math.round(rect.height)}`);
    }
    return { overflowPx, smallTargets: [...new Set(small)].slice(0, 12) };
  });
}

async function measureSpace(browser: Browser, space: (typeof SPACES)[number], account: Account, results: Measure[]) {
  const context = await browser.newContext({ viewport: VIEWPORT, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: "fr-FR", colorScheme: "light" });
  const page = await context.newPage();
  // Connexion sans ralentissement (elle n'est pas un écran mesuré).
  await page.goto(space.login);
  await page.locator('input[type="email"]').fill(account.email);
  await page.locator('input[name="password"]').fill(account.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL((url) => url.pathname.startsWith(space.home), { timeout: 60_000 });
  const cdp = await throttle(page);

  const queue: Screen[] = [...space.screens];
  for (let index = 0; index < queue.length; index += 1) {
    const screen = queue[index]!;
    const row: Measure = { space: space.space, screen: screen.screen, path: screen.path, coldMs: null, navMs: null, overflowPx: 0, smallTargets: [] };
    try {
      // 1. Navigation : première visite de l'écran dans la session, depuis l'écran précédent (données non
      //    encore en mémoire), sans recharger l'application. Rien à mesurer depuis l'écran lui-même.
      const here = new URL(page.url()).pathname;
      if (here !== screen.path.split("?")[0]) row.navMs = await timeNavigation(page, screen.path);
      Object.assign(row, await layoutChecks(page));
      // 2. Première ouverture : chargement complet de l'adresse, cache vide.
      await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
      row.coldMs = await timeLoad(page, screen.path);
      await cdp.send("Network.setCacheDisabled", { cacheDisabled: false });
      if (screen.firstLink) {
        const pattern = screen.firstLink;
        const href = await page.evaluate((source) => {
          const regex = new RegExp(source);
          return [...document.querySelectorAll("a[href]")].map((link) => link.getAttribute("href") ?? "").find((value) => regex.test(value.split("?")[0]!)) ?? null;
        }, pattern.source);
        if (href) queue.splice(index + 1, 0, { screen: `${screen.screen} : détail`, path: href.split("?")[0]! });
      }
      // L'écran suivant part d'une application neuve : ses données ne sont pas en mémoire.
      await page.goto(space.home, { waitUntil: "commit" });
      await waitReady(page, space.home).catch(() => undefined);
    } catch (error) {
      row.error = error instanceof Error ? error.message.split("\n")[0] : String(error);
      await cdp.send("Network.setCacheDisabled", { cacheDisabled: false }).catch(() => undefined);
    }
    results.push(row);
    console.log(`${row.space} · ${row.screen} : ouverture ${row.coldMs ?? "—"} ms, navigation ${row.navMs ?? "—"} ms, débordement ${row.overflowPx} px${row.error ? ` · ERREUR ${row.error}` : ""}`);
  }
  await context.close();
}

test.describe.configure({ mode: "serial", timeout: 15 * 60_000 });

test("LOT1-D9 : temps d'affichage et débordements de chaque écran sur téléphone 4G", async ({ browser }) => {
  const demo = accounts();
  test.skip(!demo, "outputs/comptes-demo.json absent : lancer npm run db:seed sur annona-dev");
  const results: Measure[] = [];
  for (const space of SPACES) {
    const account = demo![space.account];
    if (!account) continue;
    await measureSpace(browser, space, account, results);
  }
  mkdirSync(dirname(resolve(OUT)), { recursive: true });
  writeFileSync(resolve(OUT), JSON.stringify({ measuredAt: new Date().toISOString(), baseURL: process.env.E2E_BASE_URL ?? null, profile: { viewport: VIEWPORT, network: NETWORK, cpuSlowdown: 4 }, results }, null, 2));
});
