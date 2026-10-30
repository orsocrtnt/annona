import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

// Comptes de recette de la base de développement : `npm run e2e:role-accounts -- setup`.
type Account = { email: string; password: string };
const accounts = (): Record<"driver" | "dispatcher", Account> | null => {
  try {
    return JSON.parse(readFileSync(resolve("outputs/e2e-role-accounts.json"), "utf8"));
  } catch {
    return null;
  }
};
// Le Chromium « headless shell » refuse d'office les notifications : navigateur complet pour ce fichier.
test.use({ channel: "chromium" });

const API = "/api/driver/push-subscription";
const ENDPOINT = `https://web.push.apple.com/e2e-${Date.now()}`;
const keys = { p256dh: "e2eP256dh", auth: "e2eAuth" };

const login = async (page: Page, account: Account, accountType: string) => {
  expect((await page.request.post("/api/auth/login", { data: { ...account, accountType } })).status()).toBe(200);
};

test("DEMO-3B : le livreur s'abonne, les autres rôles et adresses inconnues sont refusés", async ({ page }) => {
  const roles = accounts();
  test.skip(!roles, "comptes de rôle absents : npm run e2e:role-accounts -- setup");

  expect((await page.request.post(API, { data: { endpoint: ENDPOINT, keys } })).status(), "sans session").toBe(401);

  await login(page, roles!.dispatcher, "company");
  expect((await page.request.post(API, { data: { endpoint: ENDPOINT, keys } })).status(), "dispatcher").toBe(403);
  await page.request.post("/api/auth/logout");

  await login(page, roles!.driver, "driver");
  expect(
    (await page.request.post(API, { data: { endpoint: "https://169.254.169.254/latest", keys } })).status(),
    "adresse interne refusée"
  ).toBe(400);
  expect((await page.request.post(API, { data: { endpoint: ENDPOINT, keys } })).status()).toBe(200);
  expect((await page.request.delete(API, { data: { endpoint: ENDPOINT } })).status()).toBe(200);
});

test("DEMO-3B : Profil affiche les notifications et sert le service worker et le manifeste", async ({ page, context }) => {
  const roles = accounts();
  test.skip(!roles, "comptes de rôle absents : npm run e2e:role-accounts -- setup");
  const violations: string[] = [];
  page.on("console", (message) => {
    if (/Content Security Policy/i.test(message.text())) violations.push(message.text());
  });
  await context.grantPermissions(["notifications"], { origin: new URL(test.info().project.use.baseURL!).origin });
  await login(page, roles!.driver, "driver");
  await page.goto("/driver/profile");

  const card = page.getByTestId("driver-push-settings");
  await expect(card).toBeVisible();
  await expect(card.getByRole("heading", { name: "Notifications" })).toBeVisible();
  if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    await expect(card).toContainText("Activer les notifications");
  }
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/driver.webmanifest");

  expect((await page.request.get("/driver.webmanifest")).status()).toBe(200);
  const worker = await page.request.get("/sw.js");
  expect(worker.status()).toBe(200);
  expect(worker.headers()["content-type"]).toContain("javascript");
  const registered = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.register("/sw.js");
    return Boolean(registration.scope);
  });
  expect(registered).toBe(true);
  expect(violations).toEqual([]);

  // L'accueil public reste sans manifeste : l'icône du site n'est pas touchée.
  await page.goto("/");
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(0);
});
