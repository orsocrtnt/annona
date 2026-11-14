/**
 * RECETTE-V1 / MOBILE-1 — critères 1, 7, 8 et N2 dans l'application Android (émulateur ou téléphone par USB).
 *
 * Prérequis : application de debug installée (`docs/MOBILE.md`, adresse http://localhost:3000), serveur Annona
 * sur le port 3000 (build de production conseillé), base `annona-dev`.
 *   npx dotenv -e .env.local -- npx tsx scripts/mobile/android-recette.mts
 *
 * Données : une entreprise d'essai « E2E-AND Boulangerie » (3 clients, la commande de la semaine dernière du
 * client A, une tournée attribuée au livreur pour aujourd'hui), supprimée à la fin même en cas d'échec. Rien
 * n'est écrit dans l'entreprise de démo. L'écran est piloté par le protocole Chrome DevTools de la vue web
 * (Playwright ne pilote pas la vue web Android) ; « hors réseau » = mode avion + lien adb vers le poste coupé.
 * Rapport et captures : outputs/mobile1-android/recette/.
 */
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

const TAG = "E2E-AND";
const COMPANY_NAME = `${TAG} Boulangerie`;
const DEMO_COMPANY = "demo_company_boulangerie";
const BASE = "http://localhost:3000";
const PORT = 3000;
const OUT = "outputs/mobile1-android/recette";
const PASSWORD = `E2e-${randomBytes(9).toString("base64url")}`;
const SDK = process.env.ANDROID_SDK_ROOT ?? `${process.env.LOCALAPPDATA}/Android/Sdk`;
const ADB = `${SDK}/platform-tools/adb${process.platform === "win32" ? ".exe" : ""}`;
const APP = "fr.annona.app";

const USERS = {
  driver: { email: "e2e-and-livreur@example.com", role: "driver", firstName: "Victor", lastName: "Livreur AND", merchant: null },
  a: { email: "e2e-and-client-a@example.com", role: "merchant", firstName: "Anna", lastName: "Alpha", merchant: "a" },
} as const;
const MERCHANTS = {
  a: { name: `${TAG} Café Alpha`, latitude: 48.8566, longitude: 2.3794 },
  b: { name: `${TAG} Bistrot Beta`, latitude: 48.8619, longitude: 2.3644 },
  c: { name: `${TAG} Épicerie Gamma`, latitude: 48.8498, longitude: 2.3912 },
} as const;
type MerchantKey = keyof typeof MERCHANTS;

const prisma = new PrismaClient();
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const report: Record<string, unknown> = { startedAt: new Date().toISOString() };
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const adb = (...args: string[]) => execFileSync(ADB, args, { encoding: "utf8", maxBuffer: 50e6 }).trim();
const shot = (name: string) => writeFileSync(`${OUT}/${name}.png`, execFileSync(ADB, ["exec-out", "screencap", "-p"], { maxBuffer: 50e6 }));
const parisDate = (offsetDays = 0) => {
  const at = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
};
const TODAY = parisDate(0);
const D = parisDate(1);
const LAST_WEEK = parisDate(-6);
const dbDate = (day: string) => new Date(`${day}T00:00:00.000Z`);
const focused = () => adb("shell", "dumpsys", "window").split("\n").find((line) => line.includes("mCurrentFocus")) ?? "";

// --- Vue web de l'application (protocole Chrome DevTools) ---------------------------------------------------
class AppView {
  private ws!: WebSocket;
  private id = 0;
  private pending = new Map<number, (value: { result?: { result?: { value?: unknown } } }) => void>();
  errors: string[] = [];
  /** Envois de la file du livreur (heure murale) : diagnostic N2. */
  sends: Array<{ url: string; at: number; end?: number; failed?: string; status?: number }> = [];
  private sendIds = new Map<string, number>();
  async connect() {
    const pid = adb("shell", "pidof", APP);
    if (!pid) throw new Error("Application Annona non lancée sur l'appareil.");
    adb("forward", "tcp:9333", `localabstract:webview_devtools_remote_${pid}`);
    const targets = (await (await fetch("http://localhost:9333/json/list")).json()) as Array<{ type: string; webSocketDebuggerUrl: string }>;
    const page = targets.find((target) => target.type === "page");
    if (!page) throw new Error("Vue web introuvable (application de debug ?).");
    this.ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve) => this.ws.addEventListener("open", resolve));
    this.ws.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id && this.pending.has(message.id)) { this.pending.get(message.id)!(message); this.pending.delete(message.id); }
      if (message.method === "Runtime.exceptionThrown") this.errors.push(String(message.params.exceptionDetails.exception?.description ?? "").slice(0, 200));
      if (message.method === "Network.requestWillBeSent" && /\/api\/driver\/(stops|rounds\/[^/]+\/start)/.test(message.params.request.url) && message.params.request.method === "POST") {
        this.sendIds.set(message.params.requestId, this.sends.push({ url: message.params.request.url.replace(BASE, ""), at: Date.now() }) - 1);
      }
      const index = this.sendIds.get(message.params?.requestId);
      if (index !== undefined) {
        if (message.method === "Network.responseReceived") this.sends[index]!.status = message.params.response.status;
        if (message.method === "Network.loadingFinished") this.sends[index]!.end = Date.now();
        if (message.method === "Network.loadingFailed") { this.sends[index]!.end = Date.now(); this.sends[index]!.failed = message.params.errorText; }
      }
    });
    await this.send("Runtime.enable");
    await this.send("Network.enable");
  }
  send(method: string, params: Record<string, unknown> = {}) {
    return new Promise<{ result?: { result?: { value?: unknown } } }>((resolve) => {
      const id = ++this.id;
      this.pending.set(id, resolve);
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval<T = unknown>(expression: string): Promise<T> {
    const answer = await this.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    return answer.result?.result?.value as T;
  }
  async until(expression: string, label: string, timeoutMs = 60_000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      try { if (await this.eval<boolean>(expression)) return Date.now() - started; } catch { /* page en cours de rechargement */ }
      await sleep(250);
    }
    shot(`echec-${label.replace(/\W+/g, "-")}`);
    throw new Error(`délai dépassé : ${label} (page ${await this.eval<string>("location.pathname + location.search").catch(() => "?")})`);
  }
  fill(selector: string, value: string) {
    return this.eval(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); const proto = Object.getPrototypeOf(el); Object.getOwnPropertyDescriptor(proto, "value").set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); return true; })()`);
  }
  click(expression: string) {
    return this.eval(`(() => { const el = ${expression}; if (!el) return false; el.click(); return true; })()`);
  }
  async signOut() {
    await this.send("Network.clearBrowserCookies");
    await this.eval("(() => { try { localStorage.clear(); sessionStorage.clear(); } catch {} return true; })()");
  }
  async login(email: string, home: string) {
    await this.signOut();
    await this.send("Page.navigate", { url: `${BASE}/login` });
    await this.until("location.pathname === '/login'", "page de connexion");
    await this.until("(() => { const b = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Se connecter'); return !!b && Object.keys(b).some((k) => k.startsWith('__react')); })()", "formulaire prêt");
    await sleep(800);
    await this.fill('input[type="email"]', email);
    await this.fill('input[name="password"]', PASSWORD);
    await this.click(`[...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Se connecter")`);
    await this.until(`location.pathname.startsWith(${JSON.stringify(home)}) && !!document.querySelector("main h1")`, `arrivée sur ${home}`);
  }
  close() { this.ws.close(); }
}

// --- Données d'essai -----------------------------------------------------------------------------------------
const ids = { company: "", slot: "", round: "", merchants: {} as Record<MerchantKey, string>, users: {} as Record<string, string>, products: [] as string[], stops: [] as string[] };

async function cleanup() {
  const companies = await prisma.company.findMany({ where: { name: { startsWith: TAG } }, select: { id: true } });
  for (const { id: companyId } of companies) {
    await prisma.clientNotification.deleteMany({ where: { companyId } });
    await prisma.driverLocation.deleteMany({ where: { companyId } });
    await prisma.operationJob.deleteMany({ where: { companyId } });
    await prisma.invoice.deleteMany({ where: { companyId } });
    await prisma.stop.deleteMany({ where: { companyId } });
    await prisma.round.deleteMany({ where: { companyId } });
    await prisma.order.deleteMany({ where: { companyId } });
    await prisma.recurringOrder.deleteMany({ where: { companyId } });
    await prisma.merchantPrice.deleteMany({ where: { companyId } });
    await prisma.product.deleteMany({ where: { companyId } });
    await prisma.category.deleteMany({ where: { companyId } });
    await prisma.user.deleteMany({ where: { companyId } });
    await prisma.merchant.deleteMany({ where: { companyId } });
    await prisma.slot.deleteMany({ where: { companyId } });
    await prisma.deliveryZone.deleteMany({ where: { companyId } });
    await prisma.company.delete({ where: { id: companyId } });
  }
  const emails: string[] = Object.values(USERS).map((user) => user.email);
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
  const listed = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  for (const found of (listed.data?.users ?? []).filter((user) => emails.includes(user.email ?? ""))) await supabase.auth.admin.deleteUser(found.id);
  return companies.length;
}

async function setup() {
  const demo = await prisma.company.findUniqueOrThrow({ where: { id: DEMO_COMPANY } });
  const company = await prisma.company.create({
    data: {
      name: COMPANY_NAME, slug: `e2e-and-${Date.now().toString(36)}`, status: "ACTIVE", cutoffTime: "23:59", timezone: "Europe/Paris",
      reminderLeadMinutes: 120, address: demo.address, city: demo.city, legalName: `${COMPANY_NAME} SAS`,
      billingAddress: demo.billingAddress, billingPostalCode: demo.billingPostalCode, billingCity: demo.billingCity,
      depotLatitude: demo.depotLatitude, depotLongitude: demo.depotLongitude,
    },
  });
  ids.company = company.id;
  const zone = await prisma.deliveryZone.create({ data: { companyId: company.id, name: `${TAG} Zone`, morningStart: "00:00", morningEnd: "12:00", eveningStart: "12:30", eveningEnd: "23:59" } });
  const slot = await prisma.slot.create({ data: { companyId: company.id, zoneId: zone.id, period: "MORNING", label: `${TAG} matin`, startTime: "00:00", endTime: "12:00", sortOrder: 0 } });
  await prisma.slot.create({ data: { companyId: company.id, zoneId: zone.id, period: "EVENING", label: `${TAG} soir`, startTime: "12:30", endTime: "23:59", sortOrder: 1 } });
  ids.slot = slot.id;
  const category = await prisma.category.create({ data: { companyId: company.id, name: "Pains et viennoiseries", sortOrder: 0 } });
  for (const [index, product] of [{ name: "Baguette tradition", basePriceCents: 120 }, { name: "Croissant au beurre", basePriceCents: 110 }].entries()) {
    ids.products.push((await prisma.product.create({ data: { companyId: company.id, categoryId: category.id, sortOrder: index, vatRateBasisPoints: 550, unit: "pièce", ...product } })).id);
  }
  for (const [index, [key, spec]] of Object.entries(MERCHANTS).entries()) {
    ids.merchants[key as MerchantKey] = (await prisma.merchant.create({
      data: { companyId: company.id, zoneId: zone.id, name: spec.name, address: `${index + 1} rue de la Recette`, postalCode: "75011", city: "Paris", latitude: spec.latitude, longitude: spec.longitude, billingPeriod: "DAILY", paymentMethod: "VIREMENT" },
    })).id;
  }
  const roles = new Map((await prisma.role.findMany()).map((role) => [role.slug, role.id]));
  for (const [key, spec] of Object.entries(USERS)) {
    const created = await supabase.auth.admin.createUser({ email: spec.email, password: PASSWORD, email_confirm: true });
    if (created.error || !created.data.user) throw new Error(`Compte Supabase ${key} : ${created.error?.message}`);
    ids.users[key] = (await prisma.user.create({
      data: { authId: created.data.user.id, email: spec.email, firstName: spec.firstName, lastName: spec.lastName, status: "ACTIVE", roleId: roles.get(spec.role)!, companyId: company.id, merchantId: spec.merchant ? ids.merchants[spec.merchant] : null },
    })).id;
  }
  const lines = (delivered: boolean) => ({
    create: [
      { companyId: company.id, productId: ids.products[0]!, quantityOrdered: 20, quantityDelivered: delivered ? 20 : null, unitPriceFrozenCents: 120 },
      { companyId: company.id, productId: ids.products[1]!, quantityOrdered: 10, quantityDelivered: delivered ? 10 : null, unitPriceFrozenCents: 110 },
    ],
  });
  // Critère 1 : la commande livrée de la semaine dernière, celle que A va recopier.
  await prisma.order.create({ data: { companyId: company.id, reference: `${TAG}-S-1`, merchantId: ids.merchants.a, deliveryDate: dbDate(LAST_WEEK), slotId: slot.id, status: "DELIVERED", validatedAt: new Date(), lockedAt: new Date(), deliveredAt: new Date(), createdById: ids.users.a, lines: lines(true) } });
  // Critères 7 et 8 : tournée du jour attribuée au livreur (comme après validation par l'admin), trois arrêts.
  const round = await prisma.round.create({ data: { companyId: company.id, date: dbDate(TODAY), slotId: slot.id, driverId: ids.users.driver, name: `${TAG} tournée`, status: "ASSIGNED" } });
  ids.round = round.id;
  for (const [sequence, key] of (["a", "b", "c"] as const).entries()) {
    const order = await prisma.order.create({ data: { companyId: company.id, reference: `${TAG}-J-${sequence + 1}`, merchantId: ids.merchants[key], deliveryDate: dbDate(TODAY), slotId: slot.id, status: "LOCKED", validatedAt: new Date(), lockedAt: new Date(), lines: lines(false) } });
    ids.stops.push((await prisma.stop.create({ data: { companyId: company.id, roundId: round.id, orderId: order.id, sequence: sequence + 1 } })).id);
  }
}

// Lecture tolérante : le pooler Supabase ferme parfois une connexion inactive pendant la recette.
const stopStatus = async (index: number) => {
  for (let attempt = 0; ; attempt++) {
    try { return (await prisma.stop.findUnique({ where: { id: ids.stops[index]! }, select: { status: true } }))?.status; }
    catch (error) { if (attempt >= 2) throw error; await sleep(500); }
  }
};

async function setOffline(offline: boolean) {
  adb("shell", "cmd", "connectivity", "airplane-mode", offline ? "enable" : "disable");
  if (offline) { try { adb("reverse", "--remove", `tcp:${PORT}`); } catch { /* déjà coupé */ } }
  else adb("reverse", `tcp:${PORT}`, `tcp:${PORT}`);
}

// --- Recette -------------------------------------------------------------------------------------------------
async function main() {
  mkdirSync(OUT, { recursive: true });
  adb("reverse", `tcp:${PORT}`, `tcp:${PORT}`);
  for (const permission of ["ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION"]) { try { adb("shell", "pm", "grant", APP, `android.permission.${permission}`); } catch { /* déjà accordée */ } }
  try { adb("emu", "geo", "fix", "2.378", "48.858"); } catch { /* téléphone réel : position réelle */ }
  report.leftovers = await cleanup();
  await setup();
  report.dates = { today: TODAY, D, lastWeek: LAST_WEEK };
  const view = new AppView();
  await view.connect();

  // Critère 1 : A recopie sa commande de la semaine dernière en moins d'une minute.
  await view.login(USERS.a.email, "/portal");
  shot("01-client-commander");
  const started1 = Date.now();
  await view.click(`[...document.querySelectorAll("a")].find((a) => a.textContent.trim() === "Recommander")`);
  await view.until(`location.pathname === "/portal/orders" && !!document.querySelector("[data-testid^=order-card-]")`, "historique");
  await view.click(`[...document.querySelector("[data-testid^=order-card-]").querySelectorAll("button")].find((b) => b.textContent.trim() === "Recommander")`);
  await view.until(`!!document.querySelector('[role=dialog] [data-testid=reorder-summary]') && document.querySelector('[role=dialog] [data-testid=reorder-summary]').textContent.includes("produits")`, "dialogue recommander");
  await view.fill("#reorder-other-date", D);
  shot("02-client-recommander");
  await view.click(`[...document.querySelectorAll("[role=dialog] button")].find((b) => b.textContent.trim() === "Valider la commande")`);
  await view.until(`/^\\/portal\\/orders\\/[^/]+$/.test(location.pathname) && location.search.includes("saved=1") && document.body.innerText.includes("Validée")`, "commande validée");
  const elapsed1 = Date.now() - started1;
  shot("03-client-commande-validee");
  const copied = await prisma.order.findFirst({ where: { companyId: ids.company, merchantId: ids.merchants.a, deliveryDate: dbDate(D) }, include: { lines: true } });
  report.critere1 = { elapsedMs: elapsed1, underOneMinute: elapsed1 < 60_000, status: copied?.status, lines: copied?.lines.map((line) => line.quantityOrdered) };
  console.log(`critère 1 : recopie validée en ${(elapsed1 / 1000).toFixed(1)} s (${copied?.status}, quantités ${copied?.lines.map((line) => line.quantityOrdered).join(" + ")})`);

  // Critère 7 : démarrer, « Livré », arrêt suivant dans Plans en deux appuis.
  await view.login(USERS.driver.email, "/driver");
  await view.until(`!!document.querySelector("[data-testid=driver-start]")`, "tournée attribuée");
  shot("04-livreur-tournee");
  await view.click(`document.querySelector("[data-testid=driver-start]")`);
  await view.until(`document.querySelector("[data-testid=driver-round-summary]")?.textContent.includes("En cours")`, "tournée démarrée");
  let locationMs = -1;
  const startedRound = Date.now();
  while (Date.now() - startedRound < 30_000) {
    const location = await prisma.driverLocation.findUnique({ where: { driverId: ids.users.driver! } });
    if (location) { locationMs = Date.now() - startedRound; report.location = { latitude: location.latitude, longitude: location.longitude, afterMs: locationMs }; break; }
    await sleep(500);
  }
  console.log(`position du livreur : ${locationMs >= 0 ? "reçue " + locationMs + " ms après le démarrage" : "NON reçue en 30 s"}`);
  const current = `document.querySelector('[data-testid="driver-stop"][aria-current="step"]')`;
  const firstName = await view.eval<string>(`${current}.querySelector("[data-testid=driver-stop-name]").textContent`);
  await view.click(`${current}.querySelector("[data-testid=driver-delivered]")`);
  await view.until(`!!document.querySelector("[data-testid=driver-next-dialog] [data-testid=driver-next-stop]")`, "arrêt suivant");
  shot("05-livreur-arret-suivant");
  let taps = 0;
  await view.click(`document.querySelector("[data-testid=driver-go-next]")`); taps += 1;
  await view.until(`!!document.querySelector("[data-testid=driver-nav-menu]")`, "menu Plans / Waze");
  shot("06-livreur-plans-waze");
  const plansHref = await view.eval<string | null>(`document.querySelector("[data-testid=driver-open-plans]")?.getAttribute("href") ?? null`);
  const before = focused();
  adb("logcat", "-c");
  await view.click(`document.querySelector("[data-testid=driver-open-plans]")`); taps += 1;
  await sleep(4000);
  const after = focused();
  shot("07-plans-ouvert");
  const launches = adb("logcat", "-d").split("\n").filter((line) => /START u0|ActivityNotFound|No Activity found/.test(line)).map((line) => line.replace(/^.*?(START u0|ActivityNotFound|No Activity found)/, "$1").slice(0, 220));
  const leftApp = !after.includes(APP) && after.includes("/");
  adb("shell", "am", "start", "-n", `${APP}/.MainActivity`);
  await sleep(2500);
  await view.until(`!!document.querySelector("[data-testid=driver-round-summary]")`, "retour dans l'application", 30_000);
  await view.eval(`(() => { const close = [...document.querySelectorAll("[data-testid=driver-next-dialog] button")].find((b) => b.textContent.trim() === "Fermer"); if (close) close.click(); return true; })()`);
  report.location ??= { received: false };
  report.critere7 = { taps, plansHref, leftApp, launches, focusBefore: before.trim(), focusAfter: after.trim(), firstDelivered: firstName, firstStopStatus: await stopStatus(0) };
  console.log(`critère 7 : ${taps} appuis, Plans ${leftApp ? "ouvert hors de l'application" : "NON ouvert"} (${plansHref}), premier arrêt ${await stopStatus(0)}`);

  // Critère 8 et N2 : « Livré » hors réseau, rechargement hors réseau, retour du réseau.
  await sleep(1500);
  const secondName = await view.eval<string>(`${current}.querySelector("[data-testid=driver-stop-name]").textContent`);
  setOffline(true);
  await sleep(2500);
  await view.click(`${current}.querySelector("[data-testid=driver-delivered]")`);
  await view.until(`!!document.querySelector("[data-testid=driver-next-dialog]")`, "dialogue hors réseau", 20_000);
  await view.eval(`(() => { const close = [...document.querySelectorAll("[data-testid=driver-next-dialog] button")].find((b) => b.textContent.trim() === "Fermer"); if (close) close.click(); return true; })()`);
  await view.until(`document.querySelector("[data-testid=driver-pending-count]")?.textContent.includes("1 action en attente")`, "action en attente", 20_000);
  shot("08-livreur-hors-reseau");
  const offlineStatus = await stopStatus(1);
  let offlineReload = "ok";
  try {
    await view.send("Page.reload", { ignoreCache: false });
    await sleep(3000);
    await view.until(`!!document.querySelector("[data-testid=driver-round-summary]") && (document.querySelector("[data-testid=driver-pending-count]")?.textContent ?? "").includes("1 action en attente")`, "rechargement hors réseau", 30_000);
    shot("09-livreur-recharge-hors-reseau");
  } catch (error) {
    offlineReload = `échec : ${(error as Error).message}`;
  }
  const backOnline = Date.now();
  setOffline(false);
  let networkBackMs = -1;
  while (Date.now() - backOnline < 120_000) {
    // Réseau de l'appareil (le lien adb vers le poste ne dépend pas du réseau du téléphone).
    const reachable = await view.eval<boolean>(`navigator.onLine`).catch(() => false);
    if (reachable) { networkBackMs = Date.now() - backOnline; break; }
    await sleep(250);
  }
  let syncedMs = -1;
  while (Date.now() - backOnline < 120_000) {
    if ((await stopStatus(1)) === "DELIVERED") { syncedMs = Date.now() - backOnline; break; }
    await sleep(500);
  }
  let uiClearedMs = -1;
  try { uiClearedMs = await view.until(`!document.querySelector("[data-testid=driver-pending-count]")`, "file vidée à l'écran", 120_000) + (Date.now() - backOnline - 0) * 0; } catch { /* noté plus bas */ }
  shot("10-livreur-retour-reseau");
  report.n2Sends = view.sends.map((send) => ({ url: send.url, startAfterBackMs: send.at - backOnline, durationMs: send.end ? send.end - send.at : null, status: send.status ?? null, failed: send.failed ?? null }));
  console.log("envois de la file (ms depuis le retour du réseau) :", JSON.stringify(report.n2Sends));
  report.critere8 = { stop: secondName, offlineStatus, offlineReload, networkBackMs, syncedMs, appDelayMs: syncedMs >= 0 && networkBackMs >= 0 ? syncedMs - networkBackMs : -1, uiClearedAfterMs: uiClearedMs >= 0 ? Date.now() - backOnline : -1 };
  console.log(`critère 8 : hors réseau ${offlineStatus}, rechargement hors réseau ${offlineReload}, réseau revenu sur l'appareil en ${networkBackMs} ms, synchronisé ${syncedMs} ms après (application : ${syncedMs - networkBackMs} ms) (N2)`);

  // Dernier arrêt en ligne : tournée terminée.
  await view.click(`${current}.querySelector("[data-testid=driver-delivered]")`);
  await sleep(1500);
  await view.eval(`(() => { const close = [...document.querySelectorAll("[data-testid=driver-next-dialog] button")].find((b) => b.textContent.trim() === "Fermer"); if (close) close.click(); return true; })()`);
  await view.until(`document.querySelector("[data-testid=driver-round-summary]")?.textContent.includes("Terminée")`, "tournée terminée", 30_000);
  shot("11-livreur-termine");
  report.roundStatus = (await prisma.round.findUnique({ where: { id: ids.round }, select: { status: true } }))?.status;
  report.jsErrors = view.errors;
  await view.signOut();
  await view.send("Page.navigate", { url: `${BASE}/login` });
  view.close();
}

try {
  await main();
  report.passed = true;
} catch (error) {
  report.passed = false;
  report.error = (error as Error).message;
  console.error("ÉCHEC :", (error as Error).message);
  process.exitCode = 1;
} finally {
  try { setOffline(false); } catch { /* appareil absent */ }
  try { report.cleaned = await cleanup(); } catch (error) { report.cleanupError = (error as Error).message; process.exitCode = 1; }
  report.finishedAt = new Date().toISOString();
  writeFileSync(`${OUT}/rapport.json`, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ passed: report.passed, critere1: report.critere1, critere7: report.critere7, critere8: report.critere8, roundStatus: report.roundStatus, jsErrors: report.jsErrors, cleaned: report.cleaned, error: report.error }, null, 2));
  await prisma.$disconnect();
}
